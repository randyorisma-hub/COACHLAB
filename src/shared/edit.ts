/**
 * Immutable editing operations used by the court editor. Each returns a new
 * Activity; none mutate their input.
 */
import { buildTimeline } from "./engine";
import { MOVEMENT_TYPES, type Action, type ActionType, type Activity, type Player, type Point, type Role } from "./schema";
import { newId } from "./validate";

const clone = (a: Activity): Activity => structuredClone(a);
const r1 = (v: number) => Math.round(v * 10) / 10;

export function setPlayerStart(a: Activity, playerId: string, p: Point): Activity {
  const next = clone(a);
  const pl = next.players.find((x) => x.id === playerId);
  if (pl) Object.assign(pl, { x: r1(p.x), y: r1(p.y) });
  return next;
}

export function setActionPoint(a: Activity, stepIndex: number, actionId: string, key: "to" | "via", p: Point): Activity {
  const next = clone(a);
  const act = next.steps[stepIndex]?.actions.find((x) => x.id === actionId);
  if (act) act[key] = { x: r1(p.x), y: r1(p.y) };
  return next;
}

/** Who holds the ball when a step begins. */
export function holderAtStep(a: Activity, stepIndex: number): string | null {
  return buildTimeline(a).states[stepIndex]?.holderId ?? null;
}

/**
 * Dragging a player while a step is selected: reshape their last movement in
 * that step, or create one (a dribble if they have the ball, otherwise a cut).
 * Returns the id of the action that was changed or created.
 */
export function dragPlayerInStep(a: Activity, stepIndex: number, playerId: string, p: Point): { activity: Activity; actionId: string } {
  const next = clone(a);
  const step = next.steps[stepIndex];
  const moves = step.actions.filter((x) => x.playerId === playerId && MOVEMENT_TYPES.includes(x.type));
  const last = moves.sort((x, y) => x.delay - y.delay).at(-1);
  if (last) {
    last.to = { x: r1(p.x), y: r1(p.y) };
    return { activity: next, actionId: last.id };
  }
  const type: ActionType = holderAtStep(a, stepIndex) === playerId ? "dribble" : "cut";
  const action: Action = { id: newId("act"), type, playerId, to: { x: r1(p.x), y: r1(p.y) }, via: null, targetId: null, delay: 0, duration: 1 };
  step.actions.push(action);
  step.duration = Math.max(step.duration, 1);
  return { activity: next, actionId: action.id };
}

export function addStep(a: Activity, afterIndex: number): Activity {
  const next = clone(a);
  next.steps.splice(afterIndex + 1, 0, { id: newId("step"), label: `Step ${next.steps.length + 1}`, note: "", duration: 1.5, actions: [] });
  return next;
}

export function removeStep(a: Activity, index: number): Activity {
  const next = clone(a);
  next.steps.splice(index, 1);
  return next;
}

export function moveStep(a: Activity, index: number, dir: -1 | 1): Activity {
  const j = index + dir;
  if (j < 0 || j >= a.steps.length) return a;
  const next = clone(a);
  [next.steps[index], next.steps[j]] = [next.steps[j], next.steps[index]];
  return next;
}

export function updateStep(a: Activity, index: number, patch: Partial<Pick<Activity["steps"][number], "label" | "note" | "duration">>): Activity {
  const next = clone(a);
  Object.assign(next.steps[index], patch);
  return next;
}

/** Add an action with sensible defaults for its type. */
export function addAction(a: Activity, stepIndex: number, type: ActionType, playerId: string): { activity: Activity; actionId: string } {
  const next = clone(a);
  const step = next.steps[stepIndex];
  const state = buildTimeline(a).states[stepIndex];
  const start = state?.positions[playerId] ?? { x: 25, y: 25 };
  const others = next.players.filter((p) => p.id !== playerId && p.role !== "neutral");
  const action: Action = {
    id: newId("act"),
    type,
    playerId,
    to: MOVEMENT_TYPES.includes(type) ? { x: r1(Math.min(start.x + 4, 50)), y: r1(Math.max(start.y - 6, 0)) } : null,
    via: null,
    targetId: type === "pass" ? others[0]?.id ?? null : null,
    delay: Math.max(0, ...step.actions.map((x) => x.delay + x.duration)),
    duration: type === "pass" ? 0.7 : 1,
  };
  step.actions.push(action);
  step.duration = Math.max(step.duration, action.delay + action.duration);
  return { activity: next, actionId: action.id };
}

export function updateAction(a: Activity, stepIndex: number, actionId: string, patch: Partial<Action>): Activity {
  const next = clone(a);
  const step = next.steps[stepIndex];
  const act = step?.actions.find((x) => x.id === actionId);
  if (!act) return a;
  Object.assign(act, patch);
  // Keep the shape consistent with the type.
  if (MOVEMENT_TYPES.includes(act.type)) {
    if (!act.to) {
      const from = buildTimeline(a).states[stepIndex]?.positions[act.playerId] ?? { x: 25, y: 25 };
      act.to = { x: r1(Math.min(from.x + 4, 50)), y: r1(Math.max(from.y - 6, 0)) };
    }
    if (act.type !== "screen") act.targetId = null;
  } else {
    act.to = null;
    act.via = null;
    if (act.type === "pass" && (!act.targetId || act.targetId === act.playerId)) {
      act.targetId = next.players.find((p) => p.id !== act.playerId)?.id ?? null;
    }
  }
  step.duration = Math.max(step.duration, act.delay + act.duration);
  return next;
}

export function removeAction(a: Activity, stepIndex: number, actionId: string): Activity {
  const next = clone(a);
  const step = next.steps[stepIndex];
  if (step) step.actions = step.actions.filter((x) => x.id !== actionId);
  return next;
}

/** Toggle a curve: add a control point at the bend-out midpoint, or remove it. */
export function toggleCurve(a: Activity, stepIndex: number, actionId: string): Activity {
  const next = clone(a);
  const act = next.steps[stepIndex]?.actions.find((x) => x.id === actionId);
  if (!act || !act.to) return a;
  if (act.via) {
    act.via = null;
    return next;
  }
  const tl = buildTimeline(a);
  const from = tl.states[stepIndex].positions[act.playerId];
  const mx = (from.x + act.to.x) / 2;
  const my = (from.y + act.to.y) / 2;
  const dx = act.to.x - from.x;
  const dy = act.to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  act.via = { x: r1(Math.min(Math.max(mx - (dy / len) * 5, 0), 50)), y: r1(Math.max(my + (dx / len) * 5, 0)) };
  return next;
}

const LABEL_PREFIX: Record<Role, string> = { offense: "", defense: "X", coach: "C", neutral: "S" };

export function addPlayer(a: Activity, role: Role): Activity {
  const next = clone(a);
  const labels = new Set(next.players.map((p) => p.label));
  let n = 1;
  const make = () => (role === "offense" ? `${n}` : `${LABEL_PREFIX[role]}${role === "coach" && n === 1 ? "" : n}`);
  while (labels.has(make())) n++;
  const label = make();
  const ids = new Set(next.players.map((p) => p.id));
  let id = `${role === "offense" ? "O" : LABEL_PREFIX[role]}${n}`;
  while (ids.has(id)) id = `${id}_`;
  const player: Player = { id, label, name: null, role, x: 25, y: role === "defense" ? 15 : 30 };
  next.players.push(player);
  next.playerCount = Math.max(next.playerCount, next.players.length);
  return next;
}

export function updatePlayer(a: Activity, playerId: string, patch: Partial<Pick<Player, "label" | "name" | "role">>): Activity {
  const next = clone(a);
  const p = next.players.find((x) => x.id === playerId);
  if (p) Object.assign(p, patch);
  return next;
}

/** Remove a player and every action that involves them. */
export function removePlayer(a: Activity, playerId: string): Activity {
  const next = clone(a);
  next.players = next.players.filter((p) => p.id !== playerId);
  if (next.ballStart === playerId) next.ballStart = null;
  for (const s of next.steps) {
    s.actions = s.actions
      .filter((x) => x.playerId !== playerId && !(x.type === "pass" && x.targetId === playerId))
      .map((x) => (x.targetId === playerId ? { ...x, targetId: null } : x));
  }
  return next;
}

export function blankActivity(): Activity {
  return {
    id: newId("act"),
    title: "New activity",
    kind: "drill",
    summary: "",
    objectives: [],
    level: "",
    playerCount: 5,
    durationMinutes: 10,
    court: "half",
    equipment: [],
    setup: [],
    instructions: [],
    rotations: [],
    coachingCues: [],
    variations: [],
    players: [
      { id: "O1", label: "1", name: "Point", role: "offense", x: 25, y: 28 },
      { id: "O2", label: "2", name: "Right wing", role: "offense", x: 42, y: 20 },
      { id: "O3", label: "3", name: "Left wing", role: "offense", x: 8, y: 20 },
      { id: "O4", label: "4", name: "Right block", role: "offense", x: 33, y: 8 },
      { id: "O5", label: "5", name: "Left block", role: "offense", x: 17, y: 8 },
    ],
    ballStart: "O1",
    steps: [{ id: newId("step"), label: "Step 1", note: "", duration: 1.5, actions: [] }],
    attribution: "Created by the coach in Driven Play Lab.",
  };
}
