import { describe, expect, it } from "vitest";
import { buildTimeline, frameAt } from "../src/shared/engine";
import { CATEGORIES, guessAge, LIBRARY, pickForPrompt, searchLibrary } from "../src/shared/library";
import { prepareActivity } from "../src/shared/pipeline";
import { findTravels } from "../src/shared/validate";
import { mentionsProgram } from "../src/shared/attribution";
import { act, makeActivity } from "./helpers";

describe("library contents", () => {
  it("has unique keys and ids, and covers every category", () => {
    expect(new Set(LIBRARY.map((e) => e.key)).size).toBe(LIBRARY.length);
    const ids = LIBRARY.map((e) => e.build({ playerCount: e.defaultPlayers, level: "x", minutes: 10 }).id);
    expect(new Set(ids).size).toBe(LIBRARY.length);
    for (const c of CATEGORIES) expect(LIBRARY.some((e) => e.category === c), c).toBe(true);
  });

  it("has sensible metadata and https further-reading links", () => {
    for (const e of LIBRARY) {
      expect(e.ages[0], e.key).toBeLessThanOrEqual(e.ages[1]);
      expect(e.minPlayers, e.key).toBeGreaterThanOrEqual(1);
      expect(e.defaultPlayers, e.key).toBeGreaterThanOrEqual(e.minPlayers);
      for (const r of e.references) expect(r.url, e.key).toMatch(/^https:\/\/[^\s]+$/);
    }
  });

  // Every roster size a coach is likely to type, built exactly as written (no automatic fixes needed).
  for (const e of LIBRARY) {
    it(`${e.key} builds cleanly for any roster size`, () => {
      for (const n of [e.minPlayers, 8, 12, 20, 30]) {
        const raw = e.build({ playerCount: Math.max(n, e.minPlayers), level: "8th grade", minutes: 10 });
        const labels = raw.players.map((p) => p.label);
        expect(new Set(labels).size, `${n} players: unique labels`).toBe(labels.length);
        expect(prepareActivity(raw, "library").warnings, `${n} players`).toEqual([]);
        expect(buildTimeline(raw).total, `${n} players: animates`).toBeGreaterThan(0);
      }
    });
  }

  it("never names a pro, college or national-team program in drill text", () => {
    for (const e of LIBRARY) {
      const a = e.build({ playerCount: e.defaultPlayers, level: "", minutes: 10 });
      const text = [a.title, a.summary, ...a.objectives, ...a.setup, ...a.instructions, ...a.rotations, ...a.coachingCues, ...a.variations, ...a.steps.flatMap((s) => [s.label, s.note])];
      for (const t of text) expect(mentionsProgram(t), `${e.key}: ${t}`).toBe(false);
    }
  });
});

describe("library search", () => {
  it("finds drills by skill words, including word forms", () => {
    const keys = searchLibrary({ query: "rebounding box outs" }).map((r) => r.entry.key);
    expect(keys.slice(0, 2)).toEqual(expect.arrayContaining(["shot-and-box-out-3v3"]));
    expect(searchLibrary({ query: "press breaker" })[0].entry.key).toBe("press-break-1-4");
  });

  it("filters by category, age, court and roster", () => {
    expect(searchLibrary({ category: "defense" }).every((r) => r.entry.category === "defense")).toBe(true);
    expect(searchLibrary({ age: 7 }).every((r) => r.entry.ages[0] <= 7)).toBe(true);
    const full = searchLibrary({ court: "full" });
    expect(full.length).toBeGreaterThan(0);
    expect(full.every((r) => r.entry.build({ playerCount: 10, level: "", minutes: 10 }).court === "full")).toBe(true);
    expect(searchLibrary({ players: 2 }).every((r) => r.entry.minPlayers <= 2)).toBe(true);
  });

  it("reads ages from grades, U-ages and school levels", () => {
    expect(guessAge("12 eighth graders")).toBe(13);
    expect(guessAge("my 3rd grade girls")).toBe(8);
    expect(guessAge("U12 team")).toBe(11);
    expect(guessAge("10 year olds")).toBe(10);
    expect(guessAge("varsity")).toBe(16);
    expect(guessAge("just a team")).toBeUndefined();
  });

  it("picks three relevant, varied, age-appropriate suggestions", () => {
    const picks = pickForPrompt("We have 12 eighth graders who need to improve passing and cutting.", { players: 12 });
    expect(picks).toHaveLength(3);
    expect(new Set(picks.map((p) => p.key)).size).toBe(3);
    expect(picks.every((p) => p.ages[0] <= 13 && p.ages[1] >= 13)).toBe(true);
    expect(picks[0].tags.some((t) => /pass|cut/.test(t))).toBe(true);

    const young = pickForPrompt("first grade beginners dribbling", {});
    expect(young.every((p) => p.ages[0] <= 6 + 1)).toBe(true);
    const defense = pickForPrompt("help defense and closeouts for varsity", {});
    expect(defense[0].category).toBe("defense");
  });
});

describe("traveling check", () => {
  it("flags a player who runs with the ball without dribbling", () => {
    const a = makeActivity({
      steps: [{ id: "s", label: "Run", note: "", duration: 2, actions: [act({ type: "cut", playerId: "O1", to: { x: 25, y: 8 }, duration: 2 })] }],
    });
    expect(findTravels(a)[0]).toMatch(/1 moves about 20 ft .*traveling/);
  });

  it("allows dribbling, pivots and running after the pass", () => {
    const a = makeActivity({
      steps: [
        {
          id: "s",
          label: "OK",
          note: "",
          duration: 3,
          actions: [
            act({ type: "dribble", playerId: "O1", to: { x: 25, y: 15 }, duration: 1 }),
            act({ type: "move", playerId: "O1", to: { x: 26, y: 15.5 }, delay: 1, duration: 0.3 }),
            act({ type: "pass", playerId: "O1", targetId: "O2", delay: 1.4, duration: 0.6 }),
            act({ type: "cut", playerId: "O1", to: { x: 25, y: 5 }, delay: 1.5, duration: 1 }),
          ],
        },
      ],
    });
    expect(findTravels(a)).toEqual([]);
    expect(frameAt(buildTimeline(a), 3).ball?.holderId).toBe("O2");
  });
});
