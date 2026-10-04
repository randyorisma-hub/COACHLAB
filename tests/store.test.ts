import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ForbiddenError, NotFoundError, PlaybookStore } from "../src/server/store";
import { buildTimeline, frameAt } from "../src/shared/engine";
import { LIBRARY } from "../src/shared/library";
import { prepareActivity } from "../src/shared/pipeline";
import { makeActivity } from "./helpers";

let dir: string;
let file: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "dpl-store-"));
  file = path.join(dir, "nested", "playbooks.json");
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("PlaybookStore saving", () => {
  it("persists a saved activity to disk and reloads it identically in a new process", async () => {
    const activity = prepareActivity(LIBRARY[0].build({ playerCount: 12, level: "8th grade", minutes: 10 }), "demo").activity;
    const store = new PlaybookStore(file);
    const { playbook, editToken } = await store.create("8th Grade Boys", "Eagles");
    const saved = await store.saveActivity(playbook.id, editToken, activity, "demo");

    const reloaded = new PlaybookStore(file); // fresh instance = fresh read from disk
    const pb = await reloaded.getForOwner(playbook.id, editToken);
    expect(pb.activities).toHaveLength(1);
    expect(pb.activities[0]).toEqual(saved);
    expect(pb.activities[0].activity).toEqual(activity);

    // The saved activity animates exactly like the original.
    const a = buildTimeline(activity);
    const b = buildTimeline(pb.activities[0].activity);
    expect(b.total).toBe(a.total);
    for (let t = 0; t <= a.total; t += 0.25) expect(frameAt(b, t)).toEqual(frameAt(a, t));
  });

  it("updates an activity in place when it is saved again", async () => {
    const store = new PlaybookStore(file);
    const { playbook, editToken } = await store.create("Team", "");
    const first = await store.saveActivity(playbook.id, editToken, makeActivity({ title: "v1" }), "ai");
    const second = await store.saveActivity(playbook.id, editToken, makeActivity({ title: "v2" }), "ai");
    expect(second.id).toBe(first.id);
    const pb = await store.getForOwner(playbook.id, editToken);
    expect(pb.activities.map((s) => s.activity.title)).toEqual(["v2"]);
  });

  it("requires the edit token for owner reads and every write", async () => {
    const store = new PlaybookStore(file);
    const { playbook } = await store.create("Team", "");
    await expect(store.getForOwner(playbook.id, undefined)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(store.getForOwner(playbook.id, "wrong")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(store.saveActivity(playbook.id, "wrong", makeActivity(), "ai")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(store.delete(playbook.id, playbook.shareId)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(store.getForOwner("missing", "x")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("never stores the edit token in plain text", async () => {
    const store = new PlaybookStore(file);
    const { editToken } = await store.create("Team", "");
    const raw = await readFile(file, "utf8");
    expect(raw).not.toContain(editToken);
  });

  it("shares a view-only copy without secrets, and rotating the link revokes the old one", async () => {
    const store = new PlaybookStore(file);
    const { playbook, editToken } = await store.create("Team", "");
    await store.saveActivity(playbook.id, editToken, makeActivity(), "ai");
    const shared = await store.getShared(playbook.shareId);
    expect(shared.activities).toHaveLength(1);
    expect(shared).not.toHaveProperty("shareId");
    expect(shared).not.toHaveProperty("editTokenHash");

    const rotated = await store.rotateShareId(playbook.id, editToken);
    expect(rotated.shareId).not.toBe(playbook.shareId);
    await expect(store.getShared(playbook.shareId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(store.getShared(rotated.shareId)).resolves.toBeTruthy();
  });

  it("does not lose writes under concurrent saves", async () => {
    const store = new PlaybookStore(file);
    const { playbook, editToken } = await store.create("Team", "");
    await Promise.all(
      Array.from({ length: 25 }, (_, i) => store.saveActivity(playbook.id, editToken, makeActivity({ id: `a${i}` }), "manual")),
    );
    const pb = await new PlaybookStore(file).getForOwner(playbook.id, editToken);
    expect(pb.activities).toHaveLength(25);
  });

  it("removes activities and deletes playbooks", async () => {
    const store = new PlaybookStore(file);
    const { playbook, editToken } = await store.create("Team", "");
    const saved = await store.saveActivity(playbook.id, editToken, makeActivity(), "ai");
    await store.removeActivity(playbook.id, editToken, saved.id);
    expect((await store.getForOwner(playbook.id, editToken)).activities).toEqual([]);
    await store.delete(playbook.id, editToken);
    await expect(store.getShared(playbook.shareId)).rejects.toBeInstanceOf(NotFoundError);
  });
});
