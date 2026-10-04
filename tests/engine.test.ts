import { describe, expect, it } from "vitest";
import {
  BALL_OFFSET,
  boundaries,
  buildTimeline,
  frameAt,
  stepIndexAt,
  type Frame,
} from "../src/shared/engine";
import { HOOP, type Activity } from "../src/shared/schema";
import { LIBRARY } from "../src/shared/library";
import { prepareActivity } from "../src/shared/pipeline";
import { act, makeActivity } from "./helpers";

const ctx = { playerCount: 12, level: "8th grade", minutes: 12 };
const rawActivities: Activity[] = LIBRARY.map((e) => e.build({ ...ctx, playerCount: Math.max(ctx.playerCount, e.minPlayers) }));
const demoActivities: Activity[] = rawActivities.map((a) => prepareActivity(a, "library").activity);

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const pos = (f: Frame, id: string) => f.players.find((p) => p.id === id)!;

describe("animation engine: basics", () => {
  const activity = makeActivity({
    steps: [
      {
        id: "s1",
        label: "Cut and pass",
        note: "",
        duration: 2,
        actions: [
          act({ type: "cut", playerId: "O2", to: { x: 30, y: 8 }, delay: 0, duration: 1 }),
          act({ type: "pass", playerId: "O1", targetId: "O2", delay: 1, duration: 0.5 }),
        ],
      },
      {
        id: "s2",
        label: "Shot",
        note: "",
        duration: 1,
        actions: [act({ type: "shot", playerId: "O2", targetId: "X1", delay: 0, duration: 1 })],
      },
    ],
  });
  const tl = buildTimeline(activity);

  it("starts at the declared coordinates with the ball at the ball handler", () => {
    const f = frameAt(tl, 0);
    for (const p of activity.players) expect(pos(f, p.id)).toMatchObject({ x: p.x, y: p.y });
    expect(f.ball).toMatchObject({ holderId: "O1", inFlight: false, x: 25 + BALL_OFFSET.x, y: 28 + BALL_OFFSET.y });
  });

  it("reaches each movement's destination exactly when the action ends", () => {
    expect(pos(frameAt(tl, 1), "O2")).toMatchObject({ x: 30, y: 8 });
    expect(pos(frameAt(tl, 2), "O2")).toMatchObject({ x: 30, y: 8 });
  });

  it("does not move a player before the action's delay", () => {
    const a = makeActivity({
      steps: [{ id: "s", label: "", note: "", duration: 2, actions: [act({ type: "cut", playerId: "O1", to: { x: 10, y: 10 }, delay: 1, duration: 1 })] }],
    });
    const t = buildTimeline(a);
    expect(pos(frameAt(t, 0.99), "O1")).toMatchObject({ x: 25, y: 28 });
    expect(pos(frameAt(t, 2), "O1")).toMatchObject({ x: 10, y: 10 });
  });

  it("puts the ball in flight during a pass and transfers possession at the catch", () => {
    const mid = frameAt(tl, 1.25);
    expect(mid.ball).toMatchObject({ inFlight: true, holderId: null });
    const caught = frameAt(tl, 1.5);
    expect(caught.ball).toMatchObject({ inFlight: false, holderId: "O2", x: 30 + BALL_OFFSET.x, y: 8 + BALL_OFFSET.y });
  });

  it("sends a shot to the rim and then to the rebounder", () => {
    const start = tl.stepStarts[1];
    const atRim = frameAt(tl, start + 0.7);
    expect(dist(atRim.ball!, HOOP)).toBeLessThan(1e-9);
    const end = frameAt(tl, tl.total);
    expect(end.ball?.holderId).toBe("X1");
  });

  it("follows a curved path through the via control point", () => {
    const a = makeActivity({
      steps: [
        {
          id: "s",
          label: "",
          note: "",
          duration: 1,
          actions: [act({ type: "cut", playerId: "O1", to: { x: 25, y: 8 }, via: { x: 40, y: 18 }, delay: 0, duration: 1 })],
        },
      ],
    });
    const t = buildTimeline(a);
    // easeInOut(0.5) = 0.5, quadratic Bézier midpoint = 0.25*from + 0.5*via + 0.25*to
    expect(pos(frameAt(t, 0.5), "O1")).toMatchObject({ x: 0.25 * 25 + 0.5 * 40 + 0.25 * 25, y: 0.25 * 28 + 0.5 * 18 + 0.25 * 8 });
  });

  it("clamps time to the timeline and maps time to steps", () => {
    expect(frameAt(tl, -5).time).toBe(0);
    expect(frameAt(tl, 999).time).toBe(tl.total);
    expect(stepIndexAt(tl, 0)).toBe(0);
    expect(stepIndexAt(tl, 1.99)).toBe(0);
    expect(stepIndexAt(tl, 2)).toBe(1);
    expect(stepIndexAt(tl, tl.total)).toBe(1);
    expect(boundaries(tl)).toEqual([0, 2, 3]);
  });

  it("stretches a step to fit its longest action", () => {
    const a = makeActivity({
      steps: [{ id: "s", label: "", note: "", duration: 0.5, actions: [act({ type: "cut", playerId: "O1", to: { x: 1, y: 1 }, delay: 1, duration: 2 })] }],
    });
    expect(buildTimeline(a).total).toBe(3);
  });

  it("renders an activity without steps as its setup", () => {
    const t = buildTimeline(makeActivity());
    const f = frameAt(t, 3);
    expect(t.total).toBe(0);
    expect(f.stepIndex).toBe(-1);
    expect(f.players).toHaveLength(3);
  });
});

describe("animation consistency across every library activity", () => {
  for (const activity of demoActivities) {
    describe(activity.title, () => {
      const tl = buildTimeline(activity);
      const samples: Frame[] = [];
      const dt = 0.01;
      for (let t = 0; t <= tl.total + 1e-9; t += dt) samples.push(frameAt(tl, t));
      samples.push(frameAt(tl, tl.total));

      it("keeps every player identifiable in every frame (all present, unique ids, unique labels)", () => {
        const ids = activity.players.map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(new Set(activity.players.map((p) => p.label)).size).toBe(ids.length);
        for (const f of samples) expect(f.players.map((p) => p.id)).toEqual(ids);
      });

      it("never teleports a player or the ball between consecutive frames", () => {
        const maxJump = 2; // feet per 10 ms = 200 ft/s, far above any real action
        for (let i = 1; i < samples.length; i++) {
          const a = samples[i - 1];
          const b = samples[i];
          for (const p of b.players) expect(dist(pos(a, p.id), p)).toBeLessThan(maxJump);
          if (a.ball && b.ball) expect(dist(a.ball, b.ball)).toBeLessThan(maxJump);
          expect(Boolean(a.ball)).toBe(Boolean(b.ball));
        }
      });

      it("is continuous at every step boundary and matches the precomputed step states", () => {
        tl.stepStarts.forEach((start, k) => {
          const f = frameAt(tl, start);
          const state = tl.states[k];
          for (const p of f.players) {
            expect(p.x).toBeCloseTo(state.positions[p.id].x, 9);
            expect(p.y).toBeCloseTo(state.positions[p.id].y, 9);
          }
          expect(f.ball?.holderId ?? null).toBe(state.holderId);
          if (k > 0) {
            const before = frameAt(tl, start - 1e-7);
            for (const p of f.players) expect(dist(pos(before, p.id), p)).toBeLessThan(1e-3);
          }
        });
      });

      it("keeps every frame on the court", () => {
        const maxY = activity.court === "full" ? 94 : 47;
        for (const f of samples)
          for (const p of f.players) {
            expect(p.x).toBeGreaterThanOrEqual(0);
            expect(p.x).toBeLessThanOrEqual(50);
            expect(p.y).toBeGreaterThanOrEqual(0);
            expect(p.y).toBeLessThanOrEqual(maxY);
          }
      });

      it("is deterministic (same input, same frames)", () => {
        const again = buildTimeline(structuredClone(activity));
        for (const t of [0, tl.total / 3, tl.total / 2, tl.total]) expect(frameAt(again, t)).toEqual(frameAt(tl, t));
      });

      it("has consistent ball possession (no issues)", () => {
        // Checked on the activity exactly as written: no automatic fixes, no possession or traveling issues.
        expect(prepareActivity(rawActivities[demoActivities.indexOf(activity)], "library").warnings).toEqual([]);
      });
    });
  }
});
