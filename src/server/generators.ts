import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { prepareActivity } from "../shared/pipeline";
import {
  RevisionSchema,
  SuggestionSetSchema,
  type Activity,
  type ActivityEnvelope,
  type GenerateRequest,
  type ReviseRequest,
} from "../shared/schema";
import { generationMessage, revisionMessage, SYSTEM_PROMPT } from "./prompts";
import { guessAge, pickForPrompt, type BuildContext } from "../shared/library";
import { newId } from "../shared/validate";

/** Every generated suggestion gets a fresh id so saving never overwrites another activity. */
const withFreshId = (a: Activity): Activity => ({ ...a, id: newId("act") });

export type Mode = "ai" | "demo";

export interface GenerateResult {
  mode: Mode;
  suggestions: ActivityEnvelope[];
}

export interface ReviseResult {
  mode: Mode;
  result: ActivityEnvelope;
  changeSummary: string;
}

export interface PlayGenerator {
  readonly mode: Mode;
  generate(req: GenerateRequest): Promise<GenerateResult>;
  revise(req: ReviseRequest): Promise<ReviseResult>;
}

/** Running token totals, so operators (and the eval script) can see what AI calls cost. */
export interface UsageTotals {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export const emptyUsage = (): UsageTotals => ({ calls: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 });

export function addUsage(
  totals: UsageTotals,
  usage: { input_tokens?: number | null; output_tokens?: number | null; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null } | null | undefined,
): void {
  if (!usage) return;
  totals.calls++;
  totals.inputTokens += usage.input_tokens ?? 0;
  totals.outputTokens += usage.output_tokens ?? 0;
  totals.cacheReadTokens += usage.cache_read_input_tokens ?? 0;
  totals.cacheWriteTokens += usage.cache_creation_input_tokens ?? 0;
}

/** Raised for model-side outcomes the coach should see as a friendly message. */
export class GenerationError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Real AI (server-side only; the API key never reaches the browser)
// ---------------------------------------------------------------------------

export interface AiOptions {
  model: string;
  effort: "low" | "medium" | "high" | "xhigh" | "max";
  /** Server-side refusal fallback (Claude API only). */
  fallbacks: boolean;
}

/** The subset of the SDK client this module uses (lets tests inject a fake). */
export type MessagesClient = Pick<Anthropic, "beta">;

export class AiGenerator implements PlayGenerator {
  readonly mode = "ai" as const;
  readonly usage = emptyUsage();
  constructor(private client: MessagesClient, private opts: AiOptions) {}

  private async call<T>(schema: Parameters<typeof betaZodOutputFormat>[0], userText: string): Promise<T> {
    const stream = this.client.beta.messages.stream({
      model: this.opts.model,
      max_tokens: 32000,
      thinking: { type: "adaptive" },
      output_config: { effort: this.opts.effort, format: betaZodOutputFormat(schema) },
      ...(this.opts.fallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userText }],
    });
    const message = await stream.finalMessage();
    addUsage(this.usage, message.usage);
    if (message.stop_reason === "refusal") {
      throw new GenerationError("The AI declined this request. Try rephrasing it as a basketball coaching need.", 422);
    }
    if (message.stop_reason === "max_tokens") {
      throw new GenerationError("The AI response was too long. Try asking for a simpler activity.", 502);
    }
    if (message.parsed_output == null) {
      throw new GenerationError("The AI returned an unreadable response. Please try again.", 502);
    }
    return message.parsed_output as T;
  }

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const out = await this.call<{ suggestions: Activity[] }>(SuggestionSetSchema, generationMessage(req.prompt, req.team));
    const suggestions = out.suggestions.slice(0, 3).map((a) => prepareActivity(withFreshId(a), "ai"));
    if (suggestions.length === 0) throw new GenerationError("The AI returned no suggestions. Please try again.", 502);
    return { mode: "ai", suggestions };
  }

  async revise(req: ReviseRequest): Promise<ReviseResult> {
    const out = await this.call<{ activity: Activity; changeSummary: string }>(
      RevisionSchema,
      revisionMessage(JSON.stringify(req.activity), req.instruction),
    );
    // A revision is the same activity: keep its id so re-saving updates it in place.
    const revised = { ...out.activity, id: req.activity.id };
    return { mode: "ai", result: prepareActivity(revised, "ai"), changeSummary: out.changeSummary };
  }
}

// ---------------------------------------------------------------------------
// DEMO generator: canned templates + simple rule-based revisions. Clearly
// labeled as demo in every response and in the UI.
// ---------------------------------------------------------------------------

export class DemoGenerator implements PlayGenerator {
  readonly mode = "demo" as const;

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const ctx: BuildContext = {
      playerCount: req.team?.playerCount ?? guessPlayerCount(req.prompt) ?? 10,
      level: req.team?.level || guessLevel(req.prompt) || "Youth / middle school",
      minutes: req.team?.minutes ?? 10,
    };
    const entries = pickForPrompt(req.prompt, {
      age: guessAge(`${req.team?.level ?? ""} ${req.prompt}`),
      players: ctx.playerCount,
      court: req.team?.court,
    });
    const suggestions = entries.map((e) =>
      prepareActivity(withFreshId(e.build({ ...ctx, playerCount: Math.max(ctx.playerCount, e.minPlayers) })), "demo"),
    );
    return { mode: "demo", suggestions };
  }

  async revise(req: ReviseRequest): Promise<ReviseResult> {
    const { activity, summary } = demoRevise(req.activity, req.instruction);
    return { mode: "demo", result: prepareActivity(activity, "demo"), changeSummary: summary };
  }
}

const NUMBER_WORDS: Record<string, number> = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
};

export function guessPlayerCount(prompt: string): number | undefined {
  const m = prompt.toLowerCase().match(/\b(\d{1,2}|[a-z]+)\s+(?:players|kids|athletes|girls|boys|[a-z]+ graders)\b/);
  if (!m) return undefined;
  const n = /^\d+$/.test(m[1]) ? Number(m[1]) : NUMBER_WORDS[m[1]];
  return n && n > 0 && n <= 40 ? n : undefined;
}

export function guessLevel(prompt: string): string | undefined {
  const grade = prompt.match(/\b(\d{1,2})(?:st|nd|rd|th)\s+grade(?:rs)?\b/i) ?? prompt.match(/\b(\w+th)\s+grade(?:rs)?\b/i);
  if (grade) return `${grade[1]} grade`;
  const age = prompt.match(/\b(u\d{1,2}|\d{1,2}u)\b/i);
  if (age) return age[1].toUpperCase();
  if (/\bvarsity\b/i.test(prompt)) return "High school varsity";
  if (/\bjv\b/i.test(prompt)) return "High school JV";
  return undefined;
}

/** Rule-based plain-language edits for demo mode. */
export function demoRevise(input: Activity, instruction: string): { activity: Activity; summary: string } {
  const a: Activity = structuredClone(input);
  const text = instruction.toLowerCase();
  const done: string[] = [];

  const scaleTime = (k: number) => {
    for (const s of a.steps) {
      s.duration = round(s.duration * k);
      for (const act of s.actions) {
        act.delay = round(act.delay * k);
        act.duration = round(act.duration * k);
      }
    }
  };
  if (/\b(slow|slower|walk ?through)\b/.test(text)) {
    scaleTime(1.5);
    done.push("slowed every step down by 50%");
  } else if (/\b(fast|faster|speed up|quicker|game speed)\b/.test(text)) {
    scaleTime(0.7);
    done.push("sped every step up by 30%");
  }
  if (/\b(mirror|flip|other side|opposite side|switch sides)\b/.test(text)) {
    const fx = (x: number) => round(50 - x);
    for (const p of a.players) p.x = fx(p.x);
    for (const s of a.steps)
      for (const act of s.actions) {
        if (act.to) act.to.x = fx(act.to.x);
        if (act.via) act.via.x = fx(act.via.x);
      }
    done.push("mirrored the activity to the other side of the floor");
  }
  if (/\b(add|with) (a |an |one )?(passive )?defender\b/.test(text)) {
    const holder = a.players.find((p) => p.id === a.ballStart);
    if (holder && !a.players.some((p) => p.id === "XD")) {
      a.players.push({ id: "XD", label: "XD", role: "defense", name: "Added defender", x: holder.x, y: Math.max(holder.y - 4, 0) });
      a.coachingCues.push("Defender: active hands, stay between ball and rim");
      done.push("added a defender in front of the ball handler");
    }
  }
  if (done.length === 0) {
    return {
      activity: a,
      summary:
        "Demo mode understands only: slower, faster, mirror/flip, add a defender. Connect an Anthropic API key for full plain-language revisions. No changes made.",
    };
  }
  return { activity: a, summary: `Demo revision: ${done.join("; ")}.` };
}

const round = (v: number) => Math.round(v * 100) / 100;

export function createGenerator(env: NodeJS.ProcessEnv = process.env): PlayGenerator {
  const forceDemo = env.DEMO_MODE === "1" || env.DEMO_MODE === "true";
  const hasCredentials = Boolean(env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN);
  if (forceDemo || !hasCredentials) return new DemoGenerator();
  const effort = (env.AI_EFFORT ?? "medium") as AiOptions["effort"];
  return new AiGenerator(new Anthropic(), {
    model: env.ANTHROPIC_MODEL || "claude-opus-5-5",
    effort: ["low", "medium", "high", "xhigh", "max"].includes(effort) ? effort : "medium",
    fallbacks: env.AI_FALLBACKS !== "off",
  });
}
