import type { Action, Activity } from "../src/shared/schema";

export function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "test-activity",
    title: "Test",
    kind: "drill",
    summary: "",
    objectives: [],
    level: "8th grade",
    playerCount: 3,
    durationMinutes: 10,
    court: "half",
    equipment: [],
    setup: [],
    instructions: [],
    rotations: [],
    coachingCues: [],
    variations: [],
    players: [
      { id: "O1", label: "1", name: null, role: "offense", x: 25, y: 28 },
      { id: "O2", label: "2", name: null, role: "offense", x: 42, y: 20 },
      { id: "X1", label: "X1", name: null, role: "defense", x: 38, y: 18 },
    ],
    ballStart: "O1",
    steps: [],
    attribution: "",
    ...overrides,
  };
}

export const act = (a: Partial<Action> & Pick<Action, "type" | "playerId">): Action => ({
  id: Math.random().toString(36).slice(2),
  to: null,
  via: null,
  targetId: null,
  delay: 0,
  duration: 1,
  ...a,
});
