/**
 * Coach chat: a streaming conversation with Claude that can show drills from
 * the library or design new animated activities in the middle of a reply.
 * Runs on the server only; the browser receives a stream of ChatEvents.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { mentionsProgram, stripProgramSentences } from "../shared/attribution";
import { CATEGORY_LABELS, LIBRARY, ageLabel, buildEntry, guessAge, pickForPrompt } from "../shared/library";
import { prepareActivity } from "../shared/pipeline";
import { ActivitySchema, type Activity, type ActivityEnvelope } from "../shared/schema";
import { newId } from "../shared/validate";
import { addUsage, emptyUsage, GenerationError, type AiOptions, type MessagesClient } from "./generators";
import { SYSTEM_PROMPT } from "./prompts";

export const ChatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().max(8000),
        /** Titles of activities shown with this message (assistant turns). */
        shown: z.array(z.string().max(200)).max(6).default([]),
      }),
    )
    .min(1)
    .max(40),
  team: z
    .object({
      playerCount: z.number().int().min(1).max(200).optional(),
      level: z.string().max(100).optional(),
    })
    .optional(),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export type ChatEvent =
  | { type: "text"; delta: string }
  | { type: "status"; message: string }
  | { type: "activity"; envelope: ActivityEnvelope; libraryKey: string | null }
  /** Replace the message text (used when the attribution guardrail removes a sentence). */
  | { type: "replace"; text: string; note: string }
  | { type: "done" }
  | { type: "error"; message: string };

export interface ChatEngine {
  readonly mode: "ai" | "demo";
  chat(req: ChatRequest, emit: (e: ChatEvent) => void, signal?: AbortSignal): Promise<void>;
}

const withFreshId = (a: Activity): Activity => ({ ...a, id: newId("act") });

/** One line per library entry, so the model can pick drills by key. */
export function libraryCatalog(): string {
  return LIBRARY.map((e) => {
    const a = buildEntry(e);
    return `- ${e.key} | ${a.title} | ${CATEGORY_LABELS[e.category]} | ${ageLabel(e)} | ${e.minPlayers}+ players | ${a.court} court | ${a.summary}`;
  }).join("\n");
}

export function chatSystemPrompt(guidelines: string): string {
  return `You are the coaching assistant inside Driven Play Lab, used by Driven's basketball coaches and camp staff. Coaches talk to you like an experienced colleague: they ask for drills, plays, practice and camp ideas, coaching advice, and changes to what you suggested.

# How to respond
- Be practical and conversational. Lead with the answer; keep replies short enough to read on a phone at practice.
- If something important is missing (age or level, number of players, time, space, equipment), make a sensible assumption and say what you assumed, or ask one short question when the answer would change everything.
- Use plain text with short paragraphs. You may use "- " bullet lines, numbered lines and **bold** for drill names. No tables, no headings.
- When an activity would help, show it on the court instead of only describing it:
  - Prefer drills from the Driven Play Lab library below when one fits: call show_library_activities with their keys.
  - When nothing in the library fits, design a new one with design_activity. Design one activity per call.
  - Show at most three activities per reply, and refer to them by name in your text.
- Camp games that don't use a basketball court (relays, tag games, team-builders) can be described in text without a diagram.
- Safety first for young players: water breaks, space between groups, no contact games without control.

${guidelines.trim() ? `# Driven guidelines (follow these; they come from Driven's directors)\n${guidelines.trim()}\n\n` : ""}# Designing activities (design_activity)
${SYSTEM_PROMPT}

# Driven Play Lab library (key | title | category | ages | players | court | summary)
${libraryCatalog()}`;
}

const ShowLibraryInput = z.object({
  keys: z.array(z.string()).min(1).max(3),
  playerCount: z.number().int().min(1).max(200).nullable(),
});
const DesignInput = z.object({ activity: ActivitySchema });

function toolDefinitions(): Anthropic.Beta.BetaTool[] {
  const schema = (s: z.ZodType) => {
    const { $schema: _drop, ...rest } = z.toJSONSchema(s) as Record<string, unknown>;
    return rest as Anthropic.Beta.BetaTool.InputSchema;
  };
  return [
    {
      name: "show_library_activities",
      description:
        "Show 1-3 drills from the Driven Play Lab library to the coach as animated court diagrams. Use the exact keys from the library list. Optionally size waiting lines for the coach's roster.",
      input_schema: schema(ShowLibraryInput),
      eager_input_streaming: true,
    },
    {
      name: "design_activity",
      description:
        "Design one new drill, play or game and show it to the coach as an animated court diagram. Use when no library drill fits. Follow the coordinate, action and possession rules in the system prompt.",
      input_schema: schema(DesignInput),
      eager_input_streaming: true,
    },
  ];
}

/** Convert the app's chat history into Messages API turns (text only, strictly alternating). */
export function toApiMessages(req: ChatRequest): Anthropic.Beta.BetaMessageParam[] {
  const out: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of req.messages.slice(-20)) {
    let text = m.text.trim();
    if (m.role === "assistant" && m.shown.length) text += `\n\n[Shown to the coach on the court: ${m.shown.join("; ")}]`;
    if (!text) continue;
    const last = out.at(-1);
    if (last && last.role === m.role) last.content = `${last.content as string}\n\n${text}`;
    else out.push({ role: m.role, content: text });
  }
  while (out.length && out[0].role !== "user") out.shift();
  if (!out.length || out.at(-1)!.role !== "user") throw new GenerationError("The conversation must end with a coach message.", 400);
  if (req.team?.playerCount || req.team?.level) {
    const ctx = [req.team.playerCount ? `${req.team.playerCount} players` : "", req.team.level ?? ""].filter(Boolean).join(", ");
    out[out.length - 1].content = `${out.at(-1)!.content as string}\n\n(Team context: ${ctx})`;
  }
  return out;
}

const MAX_ROUNDS = 6;
const MAX_DIAGRAM_PLAYERS = 30;

export class AiChat implements ChatEngine {
  readonly mode = "ai" as const;
  readonly usage = emptyUsage();
  constructor(
    private client: MessagesClient,
    private opts: AiOptions,
    private guidelines = "",
  ) {}

  async chat(req: ChatRequest, emit: (e: ChatEvent) => void, signal?: AbortSignal): Promise<void> {
    const messages = toApiMessages(req);
    const tools = toolDefinitions();
    const system: Anthropic.Beta.BetaTextBlockParam[] = [
      { type: "text", text: chatSystemPrompt(this.guidelines), cache_control: { type: "ephemeral" } },
    ];
    const lastUser = req.messages.at(-1)?.text ?? "";
    let replyText = "";
    let designFailures = 0;
    let shown = 0;

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const stream = this.client.beta.messages.stream(
        {
          model: this.opts.model,
          max_tokens: 32000,
          thinking: { type: "adaptive" },
          output_config: { effort: this.opts.effort },
          ...(this.opts.fallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
          system,
          tools,
          messages,
        },
        { signal },
      );
      stream.on("text", (delta) => {
        replyText += delta;
        emit({ type: "text", delta });
      });
      stream.on("streamEvent", (event) => {
        if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
          emit({ type: "status", message: event.content_block.name === "design_activity" ? "Designing a drill…" : "Pulling drills from the library…" });
        }
      });

      let message: Anthropic.Beta.BetaMessage;
      try {
        message = await stream.finalMessage();
        addUsage(this.usage, message.usage);
      } catch (err) {
        if (err instanceof Anthropic.APIError || signal?.aborted) throw err;
        // Unparseable tool input (eager streaming): re-issue the turn once.
        if (designFailures++ >= 1) throw err;
        continue;
      }

      if (message.stop_reason === "refusal") {
        emit({ type: "error", message: "The assistant declined that request. Try rephrasing it as a coaching question." });
        break;
      }
      const toolUses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      if (message.stop_reason === "max_tokens") {
        emit({ type: "error", message: "That answer ran too long and was cut off. Ask for a shorter version." });
        break;
      }
      if (toolUses.length === 0) break;

      messages.push({ role: "assistant", content: message.content });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const use of toolUses) {
        results.push(this.runTool(use, req, emit, () => shown, (n) => (shown = n), () => designFailures++, lastUser));
      }
      messages.push({ role: "user", content: results });
      if (replyText && !replyText.endsWith("\n")) {
        replyText += "\n\n";
        emit({ type: "text", delta: "\n\n" });
      }
    }

    if (mentionsProgram(replyText)) {
      emit({
        type: "replace",
        text: stripProgramSentences(replyText),
        note: "Removed a sentence that credited a pro, college or national-team program without a verified source.",
      });
    }
    emit({ type: "done" });
  }

  private runTool(
    use: Anthropic.Beta.BetaToolUseBlock,
    req: ChatRequest,
    emit: (e: ChatEvent) => void,
    getShown: () => number,
    setShown: (n: number) => void,
    countFailure: () => number,
    lastUser: string,
  ): Anthropic.Beta.BetaToolResultBlockParam {
    const error = (content: string): Anthropic.Beta.BetaToolResultBlockParam => ({ type: "tool_result", tool_use_id: use.id, is_error: true, content });
    if (getShown() >= 3) return error("Three activities are already shown in this reply. Finish your answer in text.");

    if (use.name === "show_library_activities") {
      const parsed = ShowLibraryInput.safeParse(use.input);
      if (!parsed.success) return error(JSON.stringify({ INVALID_JSON: JSON.stringify(use.input) }));
      const lines: string[] = [];
      for (const key of parsed.data.keys) {
        const entry = LIBRARY.find((e) => e.key === key);
        if (!entry) {
          lines.push(`${key}: not in the library (use a key from the list)`);
          continue;
        }
        if (getShown() >= 3) break;
        // Diagrams show at most 30 players; big camps run the drill in several groups.
        const players = Math.min(Math.max(parsed.data.playerCount ?? req.team?.playerCount ?? entry.defaultPlayers, entry.minPlayers), MAX_DIAGRAM_PLAYERS);
        const env = prepareActivity(withFreshId(buildEntry(entry, { playerCount: players, level: req.team?.level || guessLevelText(lastUser) })), "library");
        emit({ type: "activity", envelope: env, libraryKey: entry.key });
        setShown(getShown() + 1);
        lines.push(`Shown: "${env.activity.title}" (${entry.key}) for ${players} players.`);
      }
      return { type: "tool_result", tool_use_id: use.id, content: lines.join("\n") };
    }

    if (use.name === "design_activity") {
      const parsed = DesignInput.safeParse(use.input);
      if (!parsed.success) return error(JSON.stringify({ INVALID_JSON: JSON.stringify(use.input) }));
      const env = prepareActivity(withFreshId(parsed.data.activity), "ai");
      const issues = env.warnings.filter((w) => /has the ball|nobody has the ball|without the ball|traveling/.test(w));
      // Give the model one chance to fix possession/traveling problems before showing the drill.
      if (issues.length && countFailure() < 1) {
        return error(`Not shown yet. Fix these problems and call design_activity again:\n- ${issues.join("\n- ")}`);
      }
      emit({ type: "activity", envelope: env, libraryKey: null });
      setShown(getShown() + 1);
      return {
        type: "tool_result",
        tool_use_id: use.id,
        content: `Shown: "${env.activity.title}".${env.warnings.length ? ` Notes for the coach: ${env.warnings.join(" ")}` : ""}`,
      };
    }
    return error(`Unknown tool ${use.name}`);
  }
}

const guessLevelText = (text: string) => {
  const age = guessAge(text);
  return age ? `About age ${age}` : "";
};

/**
 * DEMO chat: no AI. Matches the coach's latest message against the library and
 * says plainly that it isn't a real conversation.
 */
export class DemoChat implements ChatEngine {
  readonly mode = "demo" as const;

  async chat(req: ChatRequest, emit: (e: ChatEvent) => void): Promise<void> {
    const text = req.messages.at(-1)?.text ?? "";
    const players = req.team?.playerCount ?? guessCount(text);
    const entries = pickForPrompt(text, { players });
    const intro = `Demo mode: I'm not connected to the AI yet, so I can't hold a real conversation. Here are ${entries.length} library drills that match what you wrote. Open any of them to animate and edit it.\n\n`;
    for (const chunk of intro.match(/\S+\s*/g) ?? []) emit({ type: "text", delta: chunk });
    for (const e of entries) {
      const n = Math.min(Math.max(players ?? e.defaultPlayers, e.minPlayers), MAX_DIAGRAM_PLAYERS);
      const env = prepareActivity(withFreshId(buildEntry(e, { playerCount: n, level: req.team?.level })), "library");
      emit({ type: "activity", envelope: env, libraryKey: e.key });
      emit({ type: "text", delta: `- **${env.activity.title}**: ${env.activity.summary}\n` });
    }
    emit({ type: "text", delta: "\nAsk your administrator to add an Anthropic API key to turn on the full coaching assistant." });
    emit({ type: "done" });
  }
}

export function createChatEngine(env: NodeJS.ProcessEnv, guidelines: string): ChatEngine {
  const forceDemo = env.DEMO_MODE === "1" || env.DEMO_MODE === "true";
  if (forceDemo || !(env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN)) return new DemoChat();
  const effort = (env.CHAT_EFFORT ?? env.AI_EFFORT ?? "medium") as AiOptions["effort"];
  return new AiChat(
    new Anthropic(),
    {
      model: env.ANTHROPIC_MODEL || "claude-opus-5-5",
      effort: ["low", "medium", "high", "xhigh", "max"].includes(effort) ? effort : "medium",
      fallbacks: env.AI_FALLBACKS !== "off",
    },
    guidelines,
  );
}

function guessCount(text: string): number | undefined {
  const m = text.match(/\b(\d{1,3})\s+(?:players|kids|campers|athletes|girls|boys|[a-z]+ graders)\b/i);
  const n = m ? Number(m[1]) : undefined;
  return n && n > 0 && n <= 200 ? n : undefined;
}
