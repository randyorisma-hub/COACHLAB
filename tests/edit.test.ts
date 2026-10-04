import { describe, expect, it } from "vitest";
import { addAction, addPlayer, dragPlayerInStep, removePlayer, setPlayerStart, toggleCurve, updateAction } from "../src/shared/edit";
import { buildTimeline, frameAt } from "../src/shared/engine";
import { findIssues } from "../src/shared/validate";
import { act, makeActivity } from "./helpers";

const withStep = () =>
  makeActivity({ steps: [{ id: "s1", label: "One", note: "", duration: 1, actions: [act({ id: "p", type: "pass", playerId: "O1", targetId: "O2", duration: 0.6 })] }] });

describe("editor operations keep the animation consistent", () => {
  it("moving a starting spot moves the player at t=0 without mutating the original", () => {
    const a = withStep();
    const b = setPlayerStart(a, "O2", { x: 40, y: 10 });
    expect(a.players[1]).toMatchObject({ x: 42, y: 20 });
    expect(frameAt(buildTimeline(b), 0).players[1]).toMatchObject({ x: 40, y: 10 });
  });

  it("dragging the ball handler in a step creates a dribble; dragging others creates a cut", () => {
    const a = withStep();
    const { activity: b, actionId } = dragPlayerInStep(a, 0, "O1", { x: 30, y: 20 });
    expect(b.steps[0].actions.find((x) => x.id === actionId)?.type).toBe("dribble");
    const { activity: c, actionId: cut } = dragPlayerInStep(b, 0, "X1", { x: 30, y: 12 });
    expect(c.steps[0].actions.find((x) => x.id === cut)?.type).toBe("cut");
    // Dragging again reshapes the same action instead of adding another.
    const { activity: d } = dragPlayerInStep(c, 0, "X1", { x: 31, y: 13 });
    expect(d.steps[0].actions).toHaveLength(3);
    expect(frameAt(buildTimeline(d), buildTimeline(d).total).players.find((p) => p.id === "X1")).toMatchObject({ x: 31, y: 13 });
  });

  it("changing an action's type keeps its shape valid", () => {
    const a = withStep();
    const asCut = updateAction(a, 0, "p", { type: "cut" });
    expect(asCut.steps[0].actions[0].to).not.toBeNull();
    expect(asCut.steps[0].actions[0].targetId).toBeNull();
    const backToPass = updateAction(asCut, 0, "p", { type: "pass" });
    expect(backToPass.steps[0].actions[0].to).toBeNull();
    expect(backToPass.steps[0].actions[0].targetId).toBe("O2");
  });

  it("new actions start after existing ones and stretch the step", () => {
    const { activity } = addAction(withStep(), 0, "cut", "O2");
    const added = activity.steps[0].actions[1];
    expect(added.delay).toBeCloseTo(0.6);
    expect(activity.steps[0].duration).toBeCloseTo(1.6);
  });

  it("curving a path adds a control point that the engine follows", () => {
    const { activity, actionId } = addAction(withStep(), 0, "cut", "O2");
    const curved = toggleCurve(activity, 0, actionId);
    expect(curved.steps[0].actions[1].via).not.toBeNull();
    expect(toggleCurve(curved, 0, actionId).steps[0].actions[1].via).toBeNull();
  });

  it("removing a player removes their actions and passes to them", () => {
    const b = removePlayer(withStep(), "O2");
    expect(b.steps[0].actions).toHaveLength(0);
    expect(findIssues(b)).toEqual([]);
  });

  it("new players get unique ids and labels", () => {
    const b = addPlayer(addPlayer(makeActivity(), "defense"), "defense");
    const labels = b.players.map((p) => p.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(new Set(b.players.map((p) => p.id)).size).toBe(b.players.length);
  });
});
