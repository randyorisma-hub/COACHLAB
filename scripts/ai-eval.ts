/**
 * AI evaluation: runs realistic coaching requests through the real Claude
 * integration and scores every result automatically.
 *
 *   npm run eval                 # show the plan and a cost estimate (no API calls)
 *   npm run eval -- --yes        # run everything (spends real API credit)
 *   npm run eval -- --yes --only chat --limit 3
 *   npm run eval -- --demo       # free: score the built-in demo answers (checks the harness, sets a baseline)
 *
 * Requires ANTHROPIC_API_KEY (from the environment or .env). Results are saved
 * to eval-results/<timestamp>.json and summarized in the terminal.
 */
import Anthropic from "@anthropic-ai/sdk";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AiChat, DemoChat, type ChatEvent } from "../src/server/chat";
import { AiGenerator, DemoGenerator, emptyUsage, type AiOptions, type UsageTotals } from "../src/server/generators";
import { buildTimeline } from "../src/shared/engine";
import type { ActivityEnvelope } from "../src/shared/schema";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (existsSync(path.join(root, ".env"))) process.loadEnvFile(path.join(root, ".env"));

interface GenerateCase {
  id: string;
  prompt: string;
  expect: { players?: number; age?: number; court?: "half" | "full"; keywords: string[] };
}
interface ChatCase {
  id: string;
  messages: string[];
  expect: { minActivities: number; keywords: string[] };
}
const cases = JSON.parse(readFileSync(path.join(root, "evals/cases.json"), "utf8")) as { generate: GenerateCase[]; chat: ChatCase[] };

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const only = value("only") as "generate" | "chat" | undefined;
const limit = value("limit") ? Number(value("limit")) : Infinity;
const gen = only === "chat" ? [] : cases.generate.slice(0, limit);
const chats = only === "generate" ? [] : cases.chat.slice(0, limit);

const opts: AiOptions = {
  model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
  effort: (process.env.AI_EFFORT as AiOptions["effort"]) || "medium",
  fallbacks: process.env.AI_FALLBACKS !== "off",
};

// Claude Opus 5.5 list prices, USD per million tokens. Update if you change ANTHROPIC_MODEL.
const PRICE = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 };
const dollars = (u: UsageTotals) =>
  (u.inputTokens * PRICE.input + u.outputTokens * PRICE.output + u.cacheReadTokens * PRICE.cacheRead + u.cacheWriteTokens * PRICE.cacheWrite) / 1e6;

// Rough planning numbers per case (thinking + structured output dominate); the run prints real usage.
const EST = { generate: 0.3, chat: 0.25 };
const estimate = gen.length * EST.generate + chats.length * EST.chat;

console.log(`AI evaluation plan: ${gen.length} generation case(s) + ${chats.length} chat case(s) on ${opts.model} (effort ${opts.effort}).`);
console.log(`Rough cost estimate: about $${estimate.toFixed(2)} (actual usage is measured and reported).`);
const demo = flag("demo");
if (demo) console.log("Demo mode: scoring the built-in library answers. No API calls, no cost.");
if (!flag("yes") && !demo) {
  console.log("Nothing was sent. Re-run with --yes to call the API.");
  process.exit(0);
}
if (!demo && !process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
  console.error("ANTHROPIC_API_KEY is not set. Add it to .env or the environment, then try again.");
  process.exit(1);
}

const ISSUE = /has the ball|nobody has the ball|without the ball|traveling/;
const ATTRIBUTION = /unverified reference/;

interface Check {
  name: string;
  pass: boolean;
  detail?: string;
}

function activityChecks(envs: ActivityEnvelope[], expect: { players?: number; court?: string; keywords: string[] }): Check[] {
  const checks: Check[] = [];
  const all = (name: string, fn: (e: ActivityEnvelope) => boolean, detail?: (e: ActivityEnvelope) => string) => {
    const bad = envs.filter((e) => !fn(e));
    checks.push({ name, pass: bad.length === 0, detail: bad.map((e) => `${e.activity.title}${detail ? `: ${detail(e)}` : ""}`).join(" | ") || undefined });
  };
  all("animates (2+ steps)", (e) => e.activity.steps.length >= 2 && buildTimeline(e.activity).total > 0);
  all("ball possession & traveling", (e) => !e.warnings.some((w) => ISSUE.test(w)), (e) => e.warnings.filter((w) => ISSUE.test(w)).join("; "));
  all("no automatic fixes needed", (e) => e.warnings.filter((w) => !ISSUE.test(w) && !ATTRIBUTION.test(w)).length === 0, (e) => e.warnings.join("; "));
  all("no program attribution", (e) => !e.warnings.some((w) => ATTRIBUTION.test(w)));
  all("unique player labels", (e) => new Set(e.activity.players.map((p) => p.label)).size === e.activity.players.length);
  if (expect.players) {
    const want = expect.players;
    // Diagrams cap big groups; otherwise expect roughly the roster (coaches may be added).
    const lo = Math.min(want, 30) * 0.75;
    all("roster size", (e) => e.activity.players.length >= lo && e.activity.players.length <= Math.max(want, 30) + 3, (e) => `${e.activity.players.length} players for ${want}`);
  }
  if (expect.court) all("court", (e) => e.activity.court === expect.court, (e) => e.activity.court);
  return checks;
}

const keywordCheck = (text: string, keywords: string[]): Check | null =>
  keywords.length ? { name: "on topic", pass: keywords.some((k) => text.toLowerCase().includes(k.toLowerCase())), detail: `wanted one of: ${keywords.join(", ")}` } : null;

interface CaseResult {
  id: string;
  kind: "generate" | "chat";
  seconds: number;
  cost: number;
  checks: Check[];
  error?: string;
  output: unknown;
}

const guidelinesFile = path.join(root, "content/driven-guidelines.md");
const guidelines = existsSync(guidelinesFile) ? readFileSync(guidelinesFile, "utf8").replace(/<!--[\s\S]*?-->/g, "").trim() : "";

async function runGenerate(c: GenerateCase): Promise<CaseResult> {
  const generator = demo ? Object.assign(new DemoGenerator(), { usage: emptyUsage() }) : new AiGenerator(new Anthropic(), opts);
  const start = Date.now();
  try {
    const res = await generator.generate({ prompt: c.prompt, team: c.expect.players ? { playerCount: c.expect.players } : undefined });
    const envs = res.suggestions;
    const text = envs.map((e) => [e.activity.title, e.activity.summary, ...e.activity.objectives].join(" ")).join(" ");
    const checks: Check[] = [
      { name: "three suggestions", pass: envs.length === 3, detail: `${envs.length}` },
      { name: "distinct titles", pass: new Set(envs.map((e) => e.activity.title)).size === envs.length },
      ...activityChecks(envs, c.expect),
    ];
    const kw = keywordCheck(text, c.expect.keywords);
    if (kw) checks.push(kw);
    return { id: c.id, kind: "generate", seconds: (Date.now() - start) / 1000, cost: dollars(generator.usage), checks, output: envs };
  } catch (err) {
    return { id: c.id, kind: "generate", seconds: (Date.now() - start) / 1000, cost: dollars(generator.usage), checks: [], error: String(err), output: null };
  }
}

async function runChat(c: ChatCase): Promise<CaseResult> {
  const chat = demo ? Object.assign(new DemoChat(), { usage: emptyUsage() }) : new AiChat(new Anthropic(), opts, guidelines);
  const start = Date.now();
  const transcript: { role: "user" | "assistant"; text: string; shown: string[] }[] = [];
  const turns: { text: string; activities: ActivityEnvelope[]; events: ChatEvent[] }[] = [];
  try {
    for (const userText of c.messages) {
      transcript.push({ role: "user", text: userText, shown: [] });
      const events: ChatEvent[] = [];
      await chat.chat({ messages: transcript }, (e) => events.push(e));
      let text = events.filter((e) => e.type === "text").map((e) => (e as { delta: string }).delta).join("");
      const replaced = events.find((e) => e.type === "replace") as { text: string } | undefined;
      if (replaced) text = replaced.text;
      const activities = events.filter((e) => e.type === "activity").map((e) => (e as { envelope: ActivityEnvelope }).envelope);
      turns.push({ text, activities, events });
      transcript.push({ role: "assistant", text, shown: activities.map((a) => a.activity.title) });
    }
    const last = turns.at(-1)!;
    const allActs = turns.flatMap((t) => t.activities);
    const errors = turns.flatMap((t) => t.events.filter((e) => e.type === "error"));
    const checks: Check[] = [
      { name: "no errors", pass: errors.length === 0, detail: errors.map((e) => (e as { message: string }).message).join("; ") || undefined },
      { name: "reply text", pass: last.text.trim().length > 20 },
      { name: "activities shown", pass: last.activities.length >= c.expect.minActivities && last.activities.length <= 3, detail: `${last.activities.length}` },
      { name: "no attribution clean-up needed", pass: !turns.some((t) => t.events.some((e) => e.type === "replace")) },
      ...activityChecks(allActs, { keywords: [] }),
    ];
    const kw = keywordCheck(last.text + allActs.map((a) => a.activity.title).join(" "), c.expect.keywords);
    if (kw) checks.push(kw);
    return { id: c.id, kind: "chat", seconds: (Date.now() - start) / 1000, cost: dollars(chat.usage), checks, output: turns.map((t) => ({ text: t.text, activities: t.activities })) };
  } catch (err) {
    return { id: c.id, kind: "chat", seconds: (Date.now() - start) / 1000, cost: dollars(chat.usage), checks: [], error: String(err), output: turns };
  }
}

/** Run with limited concurrency to stay under rate limits. */
async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
        const r = out[i] as unknown as CaseResult;
        const failed = r.error ? "ERROR" : `${r.checks.filter((c) => c.pass).length}/${r.checks.length}`;
        console.log(`  ${r.id.padEnd(26)} ${failed.padEnd(6)} ${r.seconds.toFixed(0).padStart(4)}s  $${r.cost.toFixed(3)}`);
      }
    }),
  );
  return out;
}

const results = [...(await pool(gen, 3, runGenerate)), ...(await pool(chats, 3, runChat))];

// Summary by check.
const byCheck = new Map<string, { pass: number; total: number }>();
for (const r of results) for (const c of r.checks) {
  const s = byCheck.get(c.name) ?? { pass: 0, total: 0 };
  s.total++;
  if (c.pass) s.pass++;
  byCheck.set(c.name, s);
}
const totalCost = results.reduce((s, r) => s + r.cost, 0);
const errors = results.filter((r) => r.error);
console.log("\nCheck pass rates:");
for (const [name, s] of byCheck) console.log(`  ${name.padEnd(32)} ${s.pass}/${s.total}`);
console.log(`\nCases with errors: ${errors.length}${errors.length ? ` (${errors.map((e) => e.id).join(", ")})` : ""}`);
console.log(`Total cost: $${totalCost.toFixed(2)}; median time: ${median(results.map((r) => r.seconds)).toFixed(0)}s`);
console.log("\nFailures:");
for (const r of results) for (const c of r.checks.filter((c) => !c.pass)) console.log(`  ${r.id}: ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);

mkdirSync(path.join(root, "eval-results"), { recursive: true });
const file = path.join(root, "eval-results", `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
writeFileSync(file, JSON.stringify({ model: demo ? "demo" : opts.model, effort: opts.effort, totalCost, results }, null, 2));
console.log(`\nFull results: ${path.relative(root, file)}`);

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}
