/**
 * Deterministic animation engine. Everything the court shows is derived from
 * an Activity (structured player coordinates + action sequences) through the
 * pure functions in this file, so playback, scrubbing and stepping always
 * agree with each other and with the saved data.
 */
import { HOOP, MOVEMENT_TYPES, type Action, type Activity, type Point } from "./schema";

export interface StepState {
  positions: Record<string, Point>;
  holderId: string | null;
  /** Where the ball rests when nobody holds it (null = no ball in this activity). */
  looseBall: Point | null;
}

export interface Timeline {
  activity: Activity;
  /** Global start time (s) of each step; length = steps.length. */
  stepStarts: number[];
  /** Total duration (s). */
  total: number;
  /** State at the start of each step; states[steps.length] is the final state. */
  states: StepState[];
}

export interface PlayerFrame {
  id: string;
  x: number;
  y: number;
}

export interface BallFrame {
  x: number;
  y: number;
  holderId: string | null;
  inFlight: boolean;
}

export interface Frame {
  time: number;
  /** Index of the step being played (-1 when the activity has no steps). */
  stepIndex: number;
  /** Seconds elapsed inside the current step. */
  stepTime: number;
  players: PlayerFrame[];
  ball: BallFrame | null;
}

/** Offset so the ball is drawn at the holder's hip rather than hidden under the marker. */
export const BALL_OFFSET: Point = { x: 1.1, y: 0.9 };

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeInOut = (u: number) => u * u * (3 - 2 * u);
export const lerp = (a: Point, b: Point, u: number): Point => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });

/** Point on a movement path; quadratic Bézier when the action has a `via` control point. */
export function pointOnPath(from: Point, to: Point, via: Point | null, u: number): Point {
  if (!via) return lerp(from, to, u);
  const a = lerp(from, via, u);
  const b = lerp(via, to, u);
  return lerp(a, b, u);
}

export const actionEnd = (a: Action) => a.delay + a.duration;
const isMovement = (a: Action) => MOVEMENT_TYPES.includes(a.type) && a.to !== null;

function movementsFor(actions: Action[], playerId: string): Action[] {
  return actions.filter((a) => a.playerId === playerId && isMovement(a)).sort((a, b) => a.delay - b.delay);
}

/** Position of one player `tau` seconds into a step that started in `state`. */
export function playerPositionInStep(state: StepState, actions: Action[], playerId: string, tau: number): Point {
  let pos = state.positions[playerId];
  if (!pos) return { x: 0, y: 0 };
  for (const a of movementsFor(actions, playerId)) {
    if (tau <= a.delay) break;
    const u = a.duration <= 0 ? 1 : clamp01((tau - a.delay) / a.duration);
    const next = pointOnPath(pos, a.to!, a.via, easeInOut(u));
    if (u < 1) return next;
    pos = { ...a.to! };
  }
  return { ...pos };
}

const ballEvents = (actions: Action[]) =>
  actions.filter((a) => a.type === "pass" || a.type === "shot").sort((a, b) => a.delay - b.delay);

/** Ball position `tau` seconds into a step. */
export function ballInStep(state: StepState, actions: Action[], tau: number): BallFrame | null {
  if (state.holderId === null && state.looseBall === null) {
    // No ball yet; a pass/shot by someone can't happen without one.
    return null;
  }
  let holder = state.holderId;
  let loose = state.looseBall;
  const pos = (id: string, t: number) => playerPositionInStep(state, actions, id, t);

  for (const e of ballEvents(actions)) {
    if (tau <= e.delay) break;
    const end = actionEnd(e);
    // The ball leaves from wherever it actually is (robust to invalid passers).
    const releaseFrom = (t: number) => (holder ? withOffset(pos(holder, t)) : loose ?? HOOP);
    if (e.type === "pass") {
      if (!e.targetId || !state.positions[e.targetId]) continue;
      if (tau < end) {
        const from = releaseFrom(e.delay);
        const to = withOffset(pos(e.targetId, end));
        const u = clamp01((tau - e.delay) / Math.max(e.duration, 1e-6));
        return { ...lerp(from, to, u), holderId: null, inFlight: true };
      }
      holder = e.targetId;
      loose = null;
    } else {
      // shot: 70% of the time to the rim, then to the rebounder (if any).
      const rebounder = e.targetId && state.positions[e.targetId] ? e.targetId : null;
      if (tau < end) {
        const from = releaseFrom(e.delay);
        const u = clamp01((tau - e.delay) / Math.max(e.duration, 1e-6));
        if (u < 0.7 || !rebounder) {
          return { ...lerp(from, HOOP, clamp01(u / 0.7)), holderId: null, inFlight: true };
        }
        const to = withOffset(pos(rebounder, end));
        return { ...lerp(HOOP, to, (u - 0.7) / 0.3), holderId: null, inFlight: true };
      }
      holder = rebounder;
      loose = rebounder ? null : { ...HOOP };
    }
  }
  if (holder) {
    const p = withOffset(pos(holder, tau));
    return { ...p, holderId: holder, inFlight: false };
  }
  return loose ? { ...loose, holderId: null, inFlight: false } : null;
}

const withOffset = (p: Point): Point => ({ x: p.x + BALL_OFFSET.x, y: p.y + BALL_OFFSET.y });

function endState(state: StepState, actions: Action[], duration: number, playerIds: string[]): StepState {
  const positions: Record<string, Point> = {};
  for (const id of playerIds) positions[id] = playerPositionInStep(state, actions, id, duration);
  const ball = ballInStep(state, actions, duration);
  return {
    positions,
    holderId: ball?.holderId ?? null,
    looseBall: ball && !ball.holderId ? { x: ball.x, y: ball.y } : null,
  };
}

export function initialState(activity: Activity): StepState {
  const positions: Record<string, Point> = {};
  for (const p of activity.players) positions[p.id] = { x: p.x, y: p.y };
  const holder = activity.ballStart && positions[activity.ballStart] ? activity.ballStart : null;
  return { positions, holderId: holder, looseBall: null };
}

export function buildTimeline(activity: Activity): Timeline {
  const ids = activity.players.map((p) => p.id);
  const states: StepState[] = [initialState(activity)];
  const stepStarts: number[] = [];
  let t = 0;
  for (const step of activity.steps) {
    stepStarts.push(t);
    const duration = stepDuration(step.duration, step.actions);
    states.push(endState(states[states.length - 1], step.actions, duration, ids));
    t += duration;
  }
  return { activity, stepStarts, total: t, states };
}

/** A step lasts at least as long as its longest action. */
export function stepDuration(declared: number, actions: Action[]): number {
  return Math.max(declared, 0, ...actions.map(actionEnd));
}

export function stepIndexAt(timeline: Timeline, time: number): number {
  const { stepStarts } = timeline;
  if (stepStarts.length === 0) return -1;
  let k = 0;
  for (let i = 0; i < stepStarts.length; i++) if (time >= stepStarts[i]) k = i;
  return k;
}

export function frameAt(timeline: Timeline, time: number): Frame {
  const { activity, states } = timeline;
  const t = Math.min(Math.max(time, 0), timeline.total);
  const k = stepIndexAt(timeline, t);
  if (k === -1) {
    const s = states[0];
    return {
      time: 0,
      stepIndex: -1,
      stepTime: 0,
      players: activity.players.map((p) => ({ id: p.id, ...s.positions[p.id] })),
      ball: s.holderId ? { ...withOffset(s.positions[s.holderId]), holderId: s.holderId, inFlight: false } : null,
    };
  }
  const step = activity.steps[k];
  const tau = t - timeline.stepStarts[k];
  const state = states[k];
  return {
    time: t,
    stepIndex: k,
    stepTime: tau,
    players: activity.players.map((p) => ({ id: p.id, ...playerPositionInStep(state, step.actions, p.id, tau) })),
    ball: ballInStep(state, step.actions, tau),
  };
}

/** Where a player is when an action begins (used to draw arrows from the right spot). */
export function actionStartPoint(timeline: Timeline, stepIndex: number, action: Action): Point {
  const step = timeline.activity.steps[stepIndex];
  return playerPositionInStep(timeline.states[stepIndex], step.actions, action.playerId, action.delay);
}

/** Where a pass is caught (receiver's position at the end of the pass). */
export function passEndPoint(timeline: Timeline, stepIndex: number, action: Action): Point | null {
  if (!action.targetId) return null;
  const step = timeline.activity.steps[stepIndex];
  const state = timeline.states[stepIndex];
  if (!state.positions[action.targetId]) return null;
  return playerPositionInStep(state, step.actions, action.targetId, actionEnd(action));
}

/** Global time of each step boundary, including 0 and the end. */
export function boundaries(timeline: Timeline): number[] {
  return [...timeline.stepStarts, timeline.total];
}
