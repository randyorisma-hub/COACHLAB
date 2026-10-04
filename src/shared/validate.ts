/**
 * Normalization (silent, safe fixes) and validation (issues a coach or the
 * model must resolve) for activities coming from the AI, the editor or storage.
 */
import {
  COURT_WIDTH,
  FULL_COURT_LENGTH,
  HALF_COURT_LENGTH,
  MOVEMENT_TYPES,
  type Action,
  type Activity,
  type Player,
  type Step,
} from "./schema";
import { actionEnd, ballInStep, buildTimeline, playerPositionInStep, stepDuration } from "./engine";

export const MIN_ACTION_SECONDS = 0.2;
export const MAX_STEP_SECONDS = 30;
export const MAX_PLAYERS = 40;
export const MAX_STEPS = 40;

const round = (v: number) => Math.round(v * 100) / 100;
const finite = (v: number, fallback: number) => (Number.isFinite(v) ? v : fallback);
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(finite(v, lo), lo), hi);

export function courtLength(activity: Pick<Activity, "court">): number {
  return activity.court === "full" ? FULL_COURT_LENGTH : HALF_COURT_LENGTH;
}

let counter = 0;
export function newId(prefix: string): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export interface NormalizeResult {
  activity: Activity;
  /** Human-readable notes about fixes that were applied. */
  fixes: string[];
}

/**
 * Make an activity safe to animate: clamp coordinates to the court, make ids
 * unique, drop actions that reference missing players, and stretch steps so
 * every action fits. Never throws.
 */
export function normalizeActivity(input: Activity): NormalizeResult {
  const fixes: string[] = [];
  const a: Activity = structuredClone(input);
  const maxY = courtLength(a);
  const pt = (p: { x: number; y: number }) => ({ x: round(clamp(p.x, 0, COURT_WIDTH)), y: round(clamp(p.y, 0, maxY)) });

  if (!a.id) a.id = newId("act");

  // Players: unique ids, short labels, on-court coordinates.
  const seen = new Set<string>();
  const players: Player[] = [];
  for (const raw of a.players.slice(0, MAX_PLAYERS)) {
    let id = (raw.id || "").trim() || `P${players.length + 1}`;
    if (seen.has(id)) {
      let n = 2;
      while (seen.has(`${id}_${n}`)) n++;
      fixes.push(`Duplicate player id "${id}" renamed to "${id}_${n}".`);
      id = `${id}_${n}`;
    }
    seen.add(id);
    const label = (raw.label || id).trim().slice(0, 3) || id.slice(0, 3);
    const clamped = pt(raw);
    if (clamped.x !== round(finite(raw.x, NaN)) || clamped.y !== round(finite(raw.y, NaN))) {
      fixes.push(`Player ${label} moved onto the court.`);
    }
    players.push({ ...raw, id, label, name: raw.name ?? null, ...clamped });
  }
  if (a.players.length > MAX_PLAYERS) fixes.push(`Only the first ${MAX_PLAYERS} players were kept.`);
  a.players = players;
  const ids = new Set(players.map((p) => p.id));

  if (a.ballStart !== null && !ids.has(a.ballStart)) {
    fixes.push(`Ball start "${a.ballStart}" is not a player; the ball now starts with nobody.`);
    a.ballStart = null;
  }

  const stepIds = new Set<string>();
  const actionIds = new Set<string>();
  const steps: Step[] = [];
  for (const rawStep of a.steps.slice(0, MAX_STEPS)) {
    const step: Step = { ...rawStep, actions: [] };
    if (!step.id || stepIds.has(step.id)) step.id = newId("step");
    stepIds.add(step.id);
    step.label = step.label || `Step ${steps.length + 1}`;
    step.note = step.note ?? "";

    for (const rawAction of rawStep.actions) {
      const act: Action = { ...rawAction };
      if (!ids.has(act.playerId)) {
        fixes.push(`Removed a ${act.type} in "${step.label}" for unknown player "${act.playerId}".`);
        continue;
      }
      if (!act.id || actionIds.has(act.id)) act.id = newId("act");
      actionIds.add(act.id);
      act.delay = round(clamp(act.delay, 0, MAX_STEP_SECONDS));
      act.duration = round(clamp(act.duration, MIN_ACTION_SECONDS, MAX_STEP_SECONDS));
      act.via = act.via ? pt(act.via) : null;

      if (MOVEMENT_TYPES.includes(act.type)) {
        if (!act.to) {
          fixes.push(`Removed a ${act.type} in "${step.label}" with no destination.`);
          continue;
        }
        act.to = pt(act.to);
        if (act.type !== "screen") act.targetId = null;
        else if (act.targetId && !ids.has(act.targetId)) act.targetId = null;
      } else {
        act.to = null;
        act.via = null;
        if (act.type === "pass" && (!act.targetId || !ids.has(act.targetId) || act.targetId === act.playerId)) {
          fixes.push(`Removed a pass in "${step.label}" with no valid receiver.`);
          continue;
        }
        if (act.type === "shot" && act.targetId && !ids.has(act.targetId)) act.targetId = null;
      }
      step.actions.push(act);
    }

    // A player can't run two paths at once: push overlapping moves later.
    for (const id of ids) {
      const moves = step.actions.filter((x) => x.playerId === id && MOVEMENT_TYPES.includes(x.type));
      moves.sort((x, y) => x.delay - y.delay);
      for (let i = 1; i < moves.length; i++) {
        const prevEnd = actionEnd(moves[i - 1]);
        if (moves[i].delay < prevEnd) {
          moves[i].delay = round(prevEnd);
          fixes.push(`Re-timed overlapping movements for ${id} in "${step.label}".`);
        }
      }
    }
    // The ball can only do one thing at a time: serialize passes/shots.
    const ballMoves = step.actions.filter((x) => x.type === "pass" || x.type === "shot").sort((x, y) => x.delay - y.delay);
    for (let i = 1; i < ballMoves.length; i++) {
      const prevEnd = actionEnd(ballMoves[i - 1]);
      if (ballMoves[i].delay < prevEnd) {
        ballMoves[i].delay = round(prevEnd);
        fixes.push(`Re-timed overlapping passes in "${step.label}".`);
      }
    }

    const longest = Math.max(0, ...step.actions.map(actionEnd));
    step.duration = round(clamp(Math.max(finite(step.duration, 1), longest), 0.5, MAX_STEP_SECONDS * 2));
    steps.push(step);
  }
  if (a.steps.length > MAX_STEPS) fixes.push(`Only the first ${MAX_STEPS} steps were kept.`);
  a.steps = steps;

  a.playerCount = Math.max(0, Math.round(finite(a.playerCount, players.length)));
  a.durationMinutes = Math.max(1, Math.round(finite(a.durationMinutes, 10)));
  return { activity: a, fixes: dedupe(fixes) };
}

const dedupe = (xs: string[]) => [...new Set(xs)];

/**
 * Logic checks that require coaching judgement to fix (the app doesn't guess):
 * passes, dribbles and shots by a player who doesn't have the ball.
 * Assumes a normalized activity.
 */
export function findIssues(activity: Activity): string[] {
  const issues: string[] = [];
  const label = (id: string | null) => activity.players.find((p) => p.id === id)?.label ?? id ?? "nobody";
  let holder: string | null = activity.ballStart;
  let ballExists = holder !== null;

  activity.steps.forEach((step, i) => {
    const where = `step ${i + 1} ("${step.label}")`;
    const events = step.actions
      .filter((a) => a.type === "pass" || a.type === "shot" || a.type === "dribble")
      .sort((a, b) => a.delay - b.delay || order(a) - order(b));
    for (const e of events) {
      if (e.type === "dribble") {
        if (holder !== e.playerId) issues.push(`${label(e.playerId)} dribbles in ${where} without the ball (${label(holder)} has it).`);
        continue;
      }
      if (!ballExists) {
        issues.push(`${label(e.playerId)} ${e.type === "pass" ? "passes" : "shoots"} in ${where}, but nobody has the ball (set a ball start or a rebounder on the previous shot).`);
        continue;
      }
      if (holder !== e.playerId) {
        issues.push(`${label(e.playerId)} ${e.type === "pass" ? "passes" : "shoots"} in ${where} but ${label(holder)} has the ball.`);
      }
      if (e.type === "pass") holder = e.targetId;
      else {
        holder = e.targetId ?? null;
        // A shot with no rebounder leaves the ball at the rim; nobody can use it after that.
        if (holder === null) ballExists = false;
      }
    }
  });
  return [...issues, ...findTravels(activity)];
}

/** Feet a player may move with the ball without dribbling (gather steps and pivots). */
export const MAX_FEET_WITHOUT_DRIBBLE = 6;

/**
 * Traveling: a player holding the ball who runs (cut / move / screen) more than
 * a couple of steps without dribbling. Measured on the animation itself, so it
 * catches a catch-on-the-run that keeps going as well as an explicit run.
 */
export function findTravels(activity: Activity): string[] {
  const issues: string[] = [];
  const label = (id: string) => activity.players.find((p) => p.id === id)?.label ?? id;
  const tl = buildTimeline(activity);
  activity.steps.forEach((step, k) => {
    const state = tl.states[k];
    const duration = stepDuration(step.duration, step.actions);
    const runners = new Set(step.actions.filter((a) => a.to && a.type !== "dribble").map((a) => a.playerId));
    for (const id of runners) {
      const dribbling = step.actions.filter((a) => a.type === "dribble" && a.playerId === id);
      let feet = 0;
      let prev: { x: number; y: number } | null = null;
      for (let t = 0; t <= duration + 1e-9; t += 0.05) {
        const pos = playerPositionInStep(state, step.actions, id, t);
        const holding = ballInStep(state, step.actions, t)?.holderId === id;
        const isDribbling = dribbling.some((d) => t >= d.delay && t <= actionEnd(d));
        if (prev && holding && !isDribbling) feet += Math.hypot(pos.x - prev.x, pos.y - prev.y);
        prev = pos;
      }
      if (feet > MAX_FEET_WITHOUT_DRIBBLE) {
        issues.push(`${label(id)} moves about ${Math.round(feet)} ft holding the ball in step ${k + 1} ("${step.label}") without dribbling (traveling).`);
      }
    }
  });
  return issues;
}

// When a dribble and a pass start together, the dribble happens first.
const order = (a: Action) => (a.type === "dribble" ? 0 : 1);
