import { describe, expect, it } from "vitest";
import { findIssues, normalizeActivity } from "../src/shared/validate";
import { enforceAttribution, mentionsProgram, ORIGINAL_ATTRIBUTION } from "../src/shared/attribution";
import { prepareActivity } from "../src/shared/pipeline";
import { act, makeActivity } from "./helpers";

describe("normalizeActivity", () => {
  it("clamps coordinates onto the court", () => {
    const { activity, fixes } = normalizeActivity(
      makeActivity({
        players: [{ id: "O1", label: "1", name: null, role: "offense", x: -4, y: 80 }],
        steps: [{ id: "s", label: "a", note: "", duration: 1, actions: [act({ type: "cut", playerId: "O1", to: { x: 70, y: -3 } })] }],
      }),
    );
    expect(activity.players[0]).toMatchObject({ x: 0, y: 47 });
    expect(activity.steps[0].actions[0].to).toEqual({ x: 50, y: 0 });
    expect(fixes.some((f) => f.includes("moved onto the court"))).toBe(true);
  });

  it("allows full-court y values on a full court", () => {
    const { activity } = normalizeActivity(
      makeActivity({ court: "full", players: [{ id: "O1", label: "1", name: null, role: "offense", x: 25, y: 90 }] }),
    );
    expect(activity.players[0].y).toBe(90);
  });

  it("makes player ids unique and keeps labels short", () => {
    const { activity } = normalizeActivity(
      makeActivity({
        players: [
          { id: "A", label: "Alpha", name: null, role: "offense", x: 1, y: 1 },
          { id: "A", label: "B", name: null, role: "offense", x: 2, y: 2 },
        ],
        ballStart: null,
      }),
    );
    expect(activity.players.map((p) => p.id)).toEqual(["A", "A_2"]);
    expect(activity.players[0].label).toBe("Alp");
  });

  it("drops actions for unknown players and passes without a valid receiver", () => {
    const { activity, fixes } = normalizeActivity(
      makeActivity({
        steps: [
          {
            id: "s",
            label: "x",
            note: "",
            duration: 1,
            actions: [
              act({ type: "cut", playerId: "ghost", to: { x: 1, y: 1 } }),
              act({ type: "pass", playerId: "O1", targetId: "O1" }),
              act({ type: "pass", playerId: "O1", targetId: "nobody" }),
              act({ type: "cut", playerId: "O2", to: null }),
            ],
          },
        ],
      }),
    );
    expect(activity.steps[0].actions).toHaveLength(0);
    expect(fixes).toHaveLength(3);
  });

  it("re-times overlapping movements and passes and stretches the step", () => {
    const { activity } = normalizeActivity(
      makeActivity({
        steps: [
          {
            id: "s",
            label: "x",
            note: "",
            duration: 1,
            actions: [
              act({ type: "cut", playerId: "O2", to: { x: 1, y: 1 }, delay: 0, duration: 1 }),
              act({ type: "cut", playerId: "O2", to: { x: 5, y: 5 }, delay: 0.5, duration: 1 }),
              act({ type: "pass", playerId: "O1", targetId: "O2", delay: 0, duration: 0.8 }),
              act({ type: "pass", playerId: "O2", targetId: "O1", delay: 0.2, duration: 0.8 }),
            ],
          },
        ],
      }),
    );
    const [c1, c2, p1, p2] = activity.steps[0].actions;
    expect(c2.delay).toBe(c1.delay + c1.duration);
    expect(p2.delay).toBe(p1.delay + p1.duration);
    expect(activity.steps[0].duration).toBe(2);
  });

  it("clears a ballStart that isn't a player", () => {
    expect(normalizeActivity(makeActivity({ ballStart: "nope" })).activity.ballStart).toBeNull();
  });

  it("is idempotent", () => {
    const once = normalizeActivity(makeActivity({ steps: [{ id: "s", label: "x", note: "", duration: 0.1, actions: [act({ type: "cut", playerId: "O1", to: { x: 99, y: 3 } })] }] })).activity;
    const twice = normalizeActivity(once);
    expect(twice.activity).toEqual(once);
    expect(twice.fixes).toEqual([]);
  });
});

describe("findIssues (ball possession)", () => {
  it("flags a pass by a player without the ball", () => {
    const issues = findIssues(
      makeActivity({
        steps: [{ id: "s", label: "Entry", note: "", duration: 1, actions: [act({ type: "pass", playerId: "O2", targetId: "O1" })] }],
      }),
    );
    expect(issues).toEqual(['2 passes in step 1 ("Entry") but 1 has the ball.']);
  });

  it("flags a dribble without the ball", () => {
    const issues = findIssues(
      makeActivity({
        steps: [{ id: "s", label: "Go", note: "", duration: 1, actions: [act({ type: "dribble", playerId: "O2", to: { x: 1, y: 1 } })] }],
      }),
    );
    expect(issues[0]).toContain("dribbles");
  });

  it("tracks possession through passes and rebounds", () => {
    const issues = findIssues(
      makeActivity({
        steps: [
          { id: "a", label: "a", note: "", duration: 2, actions: [act({ type: "pass", playerId: "O1", targetId: "O2" }), act({ type: "dribble", playerId: "O2", to: { x: 30, y: 10 }, delay: 1 })] },
          { id: "b", label: "b", note: "", duration: 1, actions: [act({ type: "shot", playerId: "O2", targetId: "X1" })] },
          { id: "c", label: "c", note: "", duration: 1, actions: [act({ type: "pass", playerId: "X1", targetId: "O1" })] },
        ],
      }),
    );
    expect(issues).toEqual([]);
  });

  it("flags using the ball after a shot with no rebounder", () => {
    const issues = findIssues(
      makeActivity({
        steps: [
          { id: "a", label: "a", note: "", duration: 1, actions: [act({ type: "shot", playerId: "O1", targetId: null })] },
          { id: "b", label: "b", note: "", duration: 1, actions: [act({ type: "pass", playerId: "O1", targetId: "O2" })] },
        ],
      }),
    );
    expect(issues[0]).toContain("nobody has the ball");
  });
});

describe("attribution guardrail", () => {
  it("detects program references", () => {
    expect(mentionsProgram("A favorite set of the Golden State Warriors")).toBe(true);
    expect(mentionsProgram("The Heat's zone")).toBe(true);
    expect(mentionsProgram("Magic happens when players cut")).toBe(false);
    expect(mentionsProgram("The Warriors' motion offense")).toBe(true);
    expect(mentionsProgram("Popular in the NBA")).toBe(true);
    expect(mentionsProgram("used by NCAA champions")).toBe(true);
    expect(mentionsProgram("Straight from USA Basketball camps")).toBe(true);
    expect(mentionsProgram("Run by the Spurs")).toBe(true);
    expect(mentionsProgram("Horns set with a Spain pick-and-roll")).toBe(false);
    expect(mentionsProgram("Feel the heat of the press")).toBe(false);
  });

  it("removes unverified attribution sentences and labels content as original", () => {
    const { activity, notes } = enforceAttribution(
      makeActivity({
        title: "Floppy Action",
        summary: "A staggered-screen set. This is the exact play the Celtics ran in the playoffs. Great for shooters.",
        coachingCues: ["Run it like the Lakers", "Wait for the screen"],
        attribution: "Boston Celtics playbook",
      }),
    );
    expect(activity.summary).toBe("A staggered-screen set. Great for shooters.");
    expect(activity.coachingCues).toEqual(["Wait for the screen"]);
    expect(activity.attribution).toBe(ORIGINAL_ATTRIBUTION);
    expect(notes).toHaveLength(1);
  });

  it("applies to generated content but leaves a coach's manual activity alone", () => {
    const raw = makeActivity({ summary: "Our version of the NBA Horns set.", attribution: "Coach's own notes" });
    expect(prepareActivity(raw, "ai").activity.summary).toBe("");
    expect(prepareActivity(raw, "manual").activity.summary).toBe(raw.summary);
    expect(prepareActivity(raw, "manual").activity.attribution).toBe("Coach's own notes");
  });
});
