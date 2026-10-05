import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp } from "../src/server/app";
import { AiChat, chatSystemPrompt, DemoChat, toApiMessages, type ChatEvent, type ChatRequest } from "../src/server/chat";
import { DemoGenerator, type MessagesClient } from "../src/server/generators";
import { PlaybookStore } from "../src/server/store";
import { createSSEParser } from "../src/client/chat";
import { LIBRARY } from "../src/shared/library";
import { act, makeActivity } from "./helpers";

let dir: string;
let store: PlaybookStore;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "dpl-chat-"));
  store = new PlaybookStore(path.join(dir, "playbooks.json"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const ask = (text: string): ChatRequest => ({ messages: [{ role: "user", text, shown: [] }] });

/** Parse an SSE response body into events. */
const events = (body: string): ChatEvent[] => createSSEParser()(body) as ChatEvent[];

interface Round {
  text?: string[];
  content: unknown[];
  stop_reason: string;
}

/** A fake streaming Messages client that plays back scripted rounds. */
function fakeClient(rounds: Round[]) {
  const calls: Record<string, unknown>[] = [];
  const client = {
    beta: {
      messages: {
        stream: (params: Record<string, unknown>) => {
          calls.push(structuredClone(params));
          const round = rounds[calls.length - 1];
          const handlers: Record<string, ((...a: unknown[]) => void)[]> = {};
          const stream = {
            on(event: string, cb: (...a: unknown[]) => void) {
              (handlers[event] ??= []).push(cb);
              return stream;
            },
            async finalMessage() {
              for (const t of round.text ?? []) for (const cb of handlers.text ?? []) cb(t, "");
              for (const block of round.content as { type: string; name?: string }[]) {
                if (block.type === "tool_use") for (const cb of handlers.streamEvent ?? []) cb({ type: "content_block_start", content_block: block }, {});
              }
              return { stop_reason: round.stop_reason, content: round.content };
            },
          };
          return stream;
        },
      },
    },
  } as unknown as MessagesClient;
  return { client, calls };
}

const toolUse = (id: string, name: string, input: unknown) => ({ type: "tool_use", id, name, input });
const opts = { model: "claude-opus-5-5", effort: "medium" as const, fallbacks: true };

async function run(chat: AiChat | DemoChat, req: ChatRequest) {
  const out: ChatEvent[] = [];
  await chat.chat(req, (e) => out.push(e));
  return out;
}

describe("SSE parser", () => {
  it("handles events split across chunks", () => {
    const parse = createSSEParser();
    expect(parse('data: {"type":"text","del')).toEqual([]);
    expect(parse('ta":"Hi"}\n\ndata: {"type":"done"}\n\n')).toEqual([{ type: "text", delta: "Hi" }, { type: "done" }]);
    expect(parse("data: not json\n\n")).toEqual([]);
  });
});

describe("conversation history", () => {
  it("alternates roles, notes shown activities and adds team context", () => {
    const msgs = toApiMessages({
      messages: [
        { role: "assistant", text: "Welcome!", shown: [] },
        { role: "user", text: "Passing drills?", shown: [] },
        { role: "assistant", text: "Try these.", shown: ["Mikan Drill"] },
        { role: "user", text: "Shorter please", shown: [] },
        { role: "user", text: "and for 10 kids", shown: [] },
      ],
      team: { playerCount: 10, level: "U10" },
    });
    expect(msgs.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(msgs[1].content).toContain("[Shown to the coach on the court: Mikan Drill]");
    expect(msgs[2].content).toContain("Shorter please\n\nand for 10 kids");
    expect(msgs[2].content).toContain("(Team context: 10 players, U10)");
  });

  it("rejects a conversation that doesn't end with the coach", () => {
    expect(() => toApiMessages({ messages: [{ role: "assistant", text: "hi", shown: [] }] })).toThrow(/must end with a coach message/);
  });
});

describe("AI chat (fake transport)", () => {
  it("streams text, shows library drills, retries a flawed design once, then shows the fixed one", async () => {
    const flawed = makeActivity({
      title: "Flawed",
      steps: [{ id: "s", label: "Bad pass", note: "", duration: 1, actions: [act({ type: "pass", playerId: "O2", targetId: "O1" })] }],
    });
    const fixed = makeActivity({
      title: "Wing Entry Read",
      steps: [{ id: "s", label: "Entry", note: "", duration: 1, actions: [act({ type: "pass", playerId: "O1", targetId: "O2" })] }],
    });
    const { client, calls } = fakeClient([
      {
        text: ["Here are two ", "finishing drills."],
        stop_reason: "tool_use",
        content: [{ type: "text", text: "Here are two finishing drills." }, toolUse("t1", "show_library_activities", { keys: ["mikan-drill", "two-line-layups"], playerCount: 12 })],
      },
      { stop_reason: "tool_use", content: [toolUse("t2", "design_activity", { activity: flawed })] },
      { stop_reason: "tool_use", content: [toolUse("t3", "design_activity", { activity: fixed })] },
      { text: ["Start with the Mikan drill."], stop_reason: "end_turn", content: [{ type: "text", text: "Start with the Mikan drill." }] },
    ]);
    const out = await run(new AiChat(client, opts, "Always keep lines short."), ask("Finishing drills for 12 kids"));

    const text = out.filter((e) => e.type === "text").map((e) => (e as { delta: string }).delta).join("");
    expect(text).toBe("Here are two finishing drills.\n\nStart with the Mikan drill.");
    const shown = out.filter((e): e is Extract<ChatEvent, { type: "activity" }> => e.type === "activity");
    expect(shown.map((e) => e.envelope.activity.title)).toEqual(["Mikan Drill", "Two-Line Layups", "Wing Entry Read"]);
    expect(shown[0].libraryKey).toBe("mikan-drill");
    expect(shown[0].envelope.origin).toBe("library");
    expect(shown[0].envelope.activity.players).toHaveLength(12);
    expect(shown[2].envelope.origin).toBe("ai");
    expect(out.some((e) => e.type === "status" && /Designing/.test(e.message))).toBe(true);
    expect(out.at(-1)).toEqual({ type: "done" });

    // Request shape: tools with eager input streaming, cached system prompt with guidelines and catalog.
    const first = calls[0] as {
      model: string;
      tools: { name: string; eager_input_streaming: boolean }[];
      system: { text: string; cache_control: unknown }[];
      thinking: unknown;
      fallbacks: string;
    };
    expect(first.model).toBe("claude-opus-5-5");
    expect(first.thinking).toEqual({ type: "adaptive" });
    expect(first.fallbacks).toBe("default");
    expect(first.tools.map((t) => t.name)).toEqual(["show_library_activities", "design_activity"]);
    expect(first.tools.every((t) => t.eager_input_streaming)).toBe(true);
    expect(first.system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(first.system[0].text).toContain("Always keep lines short.");
    for (const e of LIBRARY) expect(first.system[0].text).toContain(e.key);

    // The flawed design went back to the model as an error instead of being shown.
    const third = calls[2] as { messages: { role: string; content: { type: string; is_error?: boolean; content: string }[] }[] };
    const result = third.messages.at(-1)!.content[0];
    expect(result.is_error).toBe(true);
    expect(result.content).toMatch(/Fix these problems.*has the ball/s);
  });

  it("returns an error for invalid tool input and unknown library keys without crashing", async () => {
    const { client, calls } = fakeClient([
      { stop_reason: "tool_use", content: [toolUse("t1", "show_library_activities", { keys: ["no-such-drill"], playerCount: null }), toolUse("t2", "design_activity", { activity: { title: "half" } })] },
      { text: ["Sorry about that."], stop_reason: "end_turn", content: [] },
    ]);
    const out = await run(new AiChat(client, opts), ask("anything"));
    expect(out.filter((e) => e.type === "activity")).toHaveLength(0);
    const results = (calls[1] as { messages: { content: { content: string; is_error?: boolean }[] }[] }).messages.at(-1)!.content;
    expect(results[0].content).toMatch(/not in the library/);
    expect(results[1].is_error).toBe(true);
    expect(results[1].content).toMatch(/INVALID_JSON/);
  });

  it("removes unverified program attribution from the finished reply", async () => {
    const { client } = fakeClient([{ text: ["This is a great set. The Lakers ran it for years."], stop_reason: "end_turn", content: [] }]);
    const out = await run(new AiChat(client, opts), ask("give me a set"));
    const replace = out.find((e) => e.type === "replace") as Extract<ChatEvent, { type: "replace" }>;
    expect(replace.text).toBe("This is a great set.");
  });

  it("reports a refusal as a friendly error", async () => {
    const { client } = fakeClient([{ stop_reason: "refusal", content: [] }]);
    const out = await run(new AiChat(client, opts), ask("something"));
    expect(out.find((e) => e.type === "error")).toBeTruthy();
    expect(out.at(-1)).toEqual({ type: "done" });
  });

  it("puts the Driven guidelines in the system prompt only when provided", () => {
    expect(chatSystemPrompt("")).not.toContain("Driven guidelines");
    expect(chatSystemPrompt("Call it a 'Driven rep'.")).toContain("Call it a 'Driven rep'.");
  });
});

describe("/api/chat", () => {
  it("streams a labeled demo reply with matching library drills", async () => {
    const app = createApp({ generator: new DemoGenerator(), store, chat: new DemoChat() });
    const res = await request(app)
      .post("/api/chat")
      .send(ask("We have 12 eighth graders who need to improve passing and cutting."))
      .buffer(true)
      .parse((r, cb) => {
        let data = "";
        r.on("data", (c: Buffer) => (data += c.toString()));
        r.on("end", () => cb(null, data));
      });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/event-stream/);
    const ev = events(res.body as string);
    expect((ev[0] as { delta: string }).delta).toMatch(/^Demo/);
    const acts = ev.filter((e): e is Extract<ChatEvent, { type: "activity" }> => e.type === "activity");
    expect(acts).toHaveLength(3);
    expect(acts[0].envelope.activity.players).toHaveLength(12);
    expect(ev.at(-1)).toEqual({ type: "done" });
  });

  it("validates the request before streaming", async () => {
    const app = createApp({ generator: new DemoGenerator(), store });
    expect((await request(app).post("/api/chat").send({ messages: [] })).status).toBe(400);
    expect((await request(app).post("/api/chat").send({ messages: [{ role: "coach", text: "hi" }] })).status).toBe(400);
  });

  it("reports chat mode in /api/health", async () => {
    const res = await request(createApp({ generator: new DemoGenerator(), store })).get("/api/health");
    expect(res.body.chat).toBe("demo");
  });
});
