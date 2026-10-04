/**
 * Playbook storage: a single JSON file written atomically (temp file + rename)
 * with writes serialized through a promise queue. Swap this class for a
 * database-backed implementation with the same interface when you outgrow it.
 *
 * Access model (no accounts yet):
 *  - Creating a playbook returns a secret edit token. Only its SHA-256 hash is
 *    stored. Every write must present the token.
 *  - Each playbook also has a random shareId. Anyone with the share link can
 *    view (never edit) the playbook.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Activity, Origin, PlaybookOwnerView, PlaybookPublic, SavedActivity } from "../shared/schema";

interface PlaybookRecord extends PlaybookOwnerView {
  editTokenHash: string;
}

interface DbShape {
  version: 1;
  playbooks: PlaybookRecord[];
}

export const MAX_ACTIVITIES_PER_PLAYBOOK = 200;

export class NotFoundError extends Error {}
export class ForbiddenError extends Error {}
export class LimitError extends Error {}

const token = (bytes = 24) => randomBytes(bytes).toString("base64url");
const hash = (value: string) => createHash("sha256").update(value).digest();

export class PlaybookStore {
  private db: DbShape | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private file: string) {}

  private async load(): Promise<DbShape> {
    if (this.db) return this.db;
    try {
      const parsed = JSON.parse(await readFile(this.file, "utf8")) as DbShape;
      this.db = { version: 1, playbooks: Array.isArray(parsed.playbooks) ? parsed.playbooks : [] };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      this.db = { version: 1, playbooks: [] };
    }
    return this.db;
  }

  private async persist(): Promise<void> {
    await mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, JSON.stringify(this.db, null, 2), { mode: 0o600 });
    await rename(tmp, this.file);
  }

  /** Run a mutation exclusively, then persist. */
  private mutate<T>(fn: (db: DbShape) => T): Promise<T> {
    const run = this.queue.then(async () => {
      const db = await this.load();
      const result = fn(db);
      await this.persist();
      return result;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  private static authorize(record: PlaybookRecord, editToken: string | undefined) {
    if (!editToken) throw new ForbiddenError("Missing edit token");
    const given = hash(editToken);
    const expected = Buffer.from(record.editTokenHash, "hex");
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      throw new ForbiddenError("Invalid edit token");
    }
  }

  private static ownerView(r: PlaybookRecord): PlaybookOwnerView {
    const { editTokenHash: _omit, ...view } = r;
    return structuredClone(view);
  }

  private static publicView(r: PlaybookRecord): PlaybookPublic {
    const { editTokenHash: _a, shareId: _b, ...view } = r;
    return structuredClone(view);
  }

  private find(db: DbShape, id: string): PlaybookRecord {
    const r = db.playbooks.find((p) => p.id === id);
    if (!r) throw new NotFoundError("Playbook not found");
    return r;
  }

  async create(name: string, team: string): Promise<{ playbook: PlaybookOwnerView; editToken: string }> {
    const editToken = token(32);
    return this.mutate((db) => {
      const now = new Date().toISOString();
      const record: PlaybookRecord = {
        id: token(9),
        shareId: token(12),
        name,
        team,
        createdAt: now,
        updatedAt: now,
        activities: [],
        editTokenHash: hash(editToken).toString("hex"),
      };
      db.playbooks.push(record);
      return { playbook: PlaybookStore.ownerView(record), editToken };
    });
  }

  async getForOwner(id: string, editToken: string | undefined): Promise<PlaybookOwnerView> {
    await this.queue;
    const r = this.find(await this.load(), id);
    PlaybookStore.authorize(r, editToken);
    return PlaybookStore.ownerView(r);
  }

  async getShared(shareId: string): Promise<PlaybookPublic> {
    await this.queue;
    const r = (await this.load()).playbooks.find((p) => p.shareId === shareId);
    if (!r) throw new NotFoundError("Shared playbook not found");
    return PlaybookStore.publicView(r);
  }

  async saveActivity(id: string, editToken: string | undefined, activity: Activity, origin: Origin): Promise<SavedActivity> {
    return this.mutate((db) => {
      const r = this.find(db, id);
      PlaybookStore.authorize(r, editToken);
      const now = new Date().toISOString();
      const existing = r.activities.find((s) => s.activity.id === activity.id);
      if (existing) {
        existing.activity = structuredClone(activity);
        existing.origin = origin;
        existing.savedAt = now;
        r.updatedAt = now;
        return structuredClone(existing);
      }
      if (r.activities.length >= MAX_ACTIVITIES_PER_PLAYBOOK) throw new LimitError("Playbook is full");
      const saved: SavedActivity = { id: token(9), activity: structuredClone(activity), origin, savedAt: now };
      r.activities.push(saved);
      r.updatedAt = now;
      return structuredClone(saved);
    });
  }

  async removeActivity(id: string, editToken: string | undefined, savedId: string): Promise<void> {
    return this.mutate((db) => {
      const r = this.find(db, id);
      PlaybookStore.authorize(r, editToken);
      const before = r.activities.length;
      r.activities = r.activities.filter((s) => s.id !== savedId);
      if (r.activities.length === before) throw new NotFoundError("Activity not found");
      r.updatedAt = new Date().toISOString();
    });
  }

  async rename(id: string, editToken: string | undefined, name: string, team: string): Promise<PlaybookOwnerView> {
    return this.mutate((db) => {
      const r = this.find(db, id);
      PlaybookStore.authorize(r, editToken);
      r.name = name;
      r.team = team;
      r.updatedAt = new Date().toISOString();
      return PlaybookStore.ownerView(r);
    });
  }

  /** Replace the share link, revoking the old one. */
  async rotateShareId(id: string, editToken: string | undefined): Promise<PlaybookOwnerView> {
    return this.mutate((db) => {
      const r = this.find(db, id);
      PlaybookStore.authorize(r, editToken);
      r.shareId = token(12);
      return PlaybookStore.ownerView(r);
    });
  }

  async delete(id: string, editToken: string | undefined): Promise<void> {
    return this.mutate((db) => {
      const r = this.find(db, id);
      PlaybookStore.authorize(r, editToken);
      db.playbooks = db.playbooks.filter((p) => p.id !== id);
    });
  }
}
