import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp } from "../src/server/app";
import { AiGenerator, createGenerator, DemoGenerator, type MessagesClient } from "../src/server/generators";
import { PlaybookStore } from "../src/server/store";
import { ORIGINAL_ATTRIBUTION } from "../src/shared/attribution";
import type { Activity } from "../src/shared/schema";
import { act, makeActivity } from "./helpers";

let dir: string;
let store: PlaybookStore;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "dpl-api-"));
  store = new PlaybookStore(path.join(dir, "playbooks.json"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const PROMPT = "We have 12 eighth graders who need to improve passing and cutting.";

describe("demo mode", () => {
  const app = () => createApp({ generator: new DemoGenerator(), store });

  it("reports demo mode in /api/health", async () => {
    const res = await request(app()).get("/api/health");
    expect(res.body).toEqual({ ok: true, mode: "demo" });
  });

  it("returns three labeled demo suggestions sized to the team", async () => {
    const res = await request(app()).post("/api/generate").send({ prompt: PROMPT });
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe("demo");
    expect(res.body.suggestions).toHaveLength(3);
    for (const s of res.body.suggestions) {
      expect(s.origin).toBe("demo");
      expect(s.warnings).toEqual([]);
      expect(s.activity.attribution).toBe(ORIGINAL_ATTRIBUTION);
      expect(s.activity.level).toBe("eighth grade");
    }
    // The give-and-go drill (passing + cutting) ranks first and uses all 12 players.
    expect(res.body.suggestions[0].activity.title).toContain("Give-and-Go");
    expect(res.body.suggestions[0].activity.players).toHaveLength(12);
    const ids = res.body.suggestions.map((s: { activity: Activity }) => s.activity.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("applies simple demo revisions and keeps the activity id", async () => {
    const gen = await request(app()).post("/api/generate").send({ prompt: PROMPT });
    const activity = gen.body.suggestions[0].activity as Activity;
    const res = await request(app()).post("/api/revise").send({ activity, instruction: "Make it slower and flip it to the other side" });
    expect(res.status).toBe(200);
    expect(res.body.changeSummary).toMatch(/^Demo revision/);
    expect(res.body.result.activity.id).toBe(activity.id);
    expect(res.body.result.activity.steps[0].duration).toBeCloseTo(activity.steps[0].duration * 1.5, 1);
    expect(res.body.result.activity.players[0].x).toBeCloseTo(50 - activity.players[0].x, 5);
  });

  it("validates input", async () => {
    expect((await request(app()).post("/api/generate").send({ prompt: "" })).status).toBe(400);
    expect((await request(app()).post("/api/generate").send({ prompt: "x".repeat(5000) })).status).toBe(400);
    expect((await request(app()).post("/api/revise").send({ activity: { nope: 1 }, instruction: "slower" })).status).toBe(400);
  });

  it("rate-limits AI endpoints per client", async () => {
    const limited = createApp({ generator: new DemoGenerator(), store, aiRequestsPerMinute: 2 });
    for (let i = 0; i < 2; i++) expect((await request(limited).post("/api/generate").send({ prompt: PROMPT })).status).toBe(200);
    const res = await request(limited).post("/api/generate").send({ prompt: PROMPT });
    expect(res.status).toBe(429);
    expect(res.headers["retry-after"]).toBeDefined();
  });

  it("sets security headers", async () => {
    const res = await request(app()).get("/api/health");
    expect(res.headers["content-security-policy"]).toContain("default-src 'self'");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("saving and sharing through the API", () => {
  const app = () => createApp({ generator: new DemoGenerator(), store });

  it("saves a suggestion to a playbook and shares a view-only link", async () => {
    const server = app();
    const gen = await request(server).post("/api/generate").send({ prompt: PROMPT });
    const suggestion = gen.body.suggestions[0];

    const created = await request(server).post("/api/playbooks").send({ name: "8th Grade", team: "Eagles" });
    expect(created.status).toBe(201);
    const { playbook, editToken } = created.body;

    const saved = await request(server)
      .post(`/api/playbooks/${playbook.id}/activities`)
      .set("x-edit-token", editToken)
      .send({ activity: suggestion.activity, origin: suggestion.origin });
    expect(saved.status).toBe(201);
    expect(saved.body.activity).toEqual(suggestion.activity);

    const owner = await request(server).get(`/api/playbooks/${playbook.id}`).set("x-edit-token", editToken);
    expect(owner.body.activities).toHaveLength(1);
    expect(owner.body.shareId).toBe(playbook.shareId);

    const shared = await request(server).get(`/api/share/${playbook.shareId}`);
    expect(shared.status).toBe(200);
    expect(shared.body.activities[0].activity).toEqual(suggestion.activity);
    expect(shared.body.shareId).toBeUndefined();
    expect(JSON.stringify(shared.body)).not.toContain(editToken);

    // The share id grants no write access.
    const hijack = await request(server)
      .post(`/api/playbooks/${playbook.id}/activities`)
      .set("x-edit-token", playbook.shareId)
      .send({ activity: suggestion.activity, origin: "demo" });
    expect(hijack.status).toBe(403);
    const noToken = await request(server).delete(`/api/playbooks/${playbook.id}`);
    expect(noToken.status).toBe(403);
  });

  it("normalizes activities before storing them", async () => {
    const server = app();
    const { body } = await request(server).post("/api/playbooks").send({ name: "Team" });
    const messy = makeActivity({ players: [{ id: "O1", label: "1", name: null, role: "offense", x: 500, y: -10 }] });
    const saved = await request(server)
      .post(`/api/playbooks/${body.playbook.id}/activities`)
      .set("x-edit-token", body.editToken)
      .send({ activity: messy, origin: "manual" });
    expect(saved.body.activity.players[0]).toMatchObject({ x: 50, y: 0 });
  });

  it("returns 404 for unknown share links", async () => {
    expect((await request(app()).get("/api/share/does-not-exist")).status).toBe(404);
  });
});

describe("AI mode (server-side SDK, faked transport)", () => {
  function fakeClient(output: unknown, stop_reason = "end_turn") {
    const calls: Record<string, unknown>[] = [];
    const client = {
      beta: {
        messages: {
          stream: (params: Record<string, unknown>) => {
            calls.push(params);
            return { finalMessage: async () => ({ stop_reason, parsed_output: output, content: [] }) };
          },
        },
      },
    } as unknown as MessagesClient;
    return { client, calls };
  }

  const aiActivity = (title: string): Activity =>
    makeActivity({
      id: "model-id",
      title,
      summary: "Spacing drill. The Lakers ran this in 2001.",
      attribution: "Los Angeles Lakers",
      steps: [{ id: "s1", label: "Pass", note: "", duration: 1, actions: [act({ type: "pass", playerId: "O1", targetId: "O2" })] }],
    });

  it("calls Claude with structured output, adaptive thinking and the coach's prompt", async () => {
    const { client, calls } = fakeClient({ suggestions: [aiActivity("A"), aiActivity("B"), aiActivity("C")] });
    const app = createApp({ generator: new AiGenerator(client, { model: "claude-opus-5-5", effort: "medium", fallbacks: true }), store });
    const res = await request(app).post("/api/generate").send({ prompt: PROMPT, team: { playerCount: 12, level: "8th grade" } });

    expect(res.status).toBe(200);
    expect(res.body.mode).toBe("ai");
    expect(res.body.suggestions).toHaveLength(3);
    const params = calls[0] as {
      model: string;
      thinking: unknown;
      output_config: { effort: string; format: unknown };
      fallbacks: string;
      messages: { content: string }[];
    };
    expect(params.model).toBe("claude-opus-5-5");
    expect(params.thinking).toEqual({ type: "adaptive" });
    expect(params.output_config.effort).toBe("medium");
    expect(params.output_config.format).toBeTruthy();
    expect(params.fallbacks).toBe("default");
    expect(params.messages[0].content).toContain(PROMPT);
    expect(params.messages[0].content).toContain("Players available: 12");

    // Guardrail + provenance applied to model output.
    const first = res.body.suggestions[0];
    expect(first.origin).toBe("ai");
    expect(first.activity.summary).toBe("Spacing drill.");
    expect(first.activity.attribution).toBe(ORIGINAL_ATTRIBUTION);
    expect(first.activity.id).not.toBe("model-id");
  });

  it("surfaces a refusal as a friendly 422", async () => {
    const { client } = fakeClient(null, "refusal");
    const app = createApp({ generator: new AiGenerator(client, { model: "m", effort: "low", fallbacks: false }), store });
    const res = await request(app).post("/api/generate").send({ prompt: PROMPT });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/declined/);
  });

  it("reports a missing parse as 502 without leaking details", async () => {
    const { client } = fakeClient(null);
    const app = createApp({ generator: new AiGenerator(client, { model: "m", effort: "low", fallbacks: false }), store });
    const res = await request(app).post("/api/generate").send({ prompt: PROMPT });
    expect(res.status).toBe(502);
  });

  it("keeps the activity id on revision and reports possession issues", async () => {
    const revised = aiActivity("Revised");
    revised.steps[0].actions[0].playerId = "O2"; // O2 passes but O1 has the ball
    revised.steps[0].actions[0].targetId = "O1";
    const { client, calls } = fakeClient({ activity: revised, changeSummary: "Moved the pass." });
    const app = createApp({ generator: new AiGenerator(client, { model: "m", effort: "low", fallbacks: false }), store });
    const original = makeActivity({ id: "keep-me" });
    const res = await request(app).post("/api/revise").send({ activity: original, instruction: "Add a wing entry" });
    expect(res.status).toBe(200);
    expect(res.body.result.activity.id).toBe("keep-me");
    expect(res.body.changeSummary).toBe("Moved the pass.");
    expect(res.body.result.warnings.some((w: string) => w.includes("has the ball"))).toBe(true);
    expect((calls[0] as { betas?: unknown }).betas).toBeUndefined();
  });

  it("uses demo mode when no credentials are configured, and AI mode when they are", () => {
    expect(createGenerator({}).mode).toBe("demo");
    expect(createGenerator({ ANTHROPIC_API_KEY: "sk-test", DEMO_MODE: "1" }).mode).toBe("demo");
    expect(createGenerator({ ANTHROPIC_API_KEY: "sk-test" }).mode).toBe("ai");
  });
});
