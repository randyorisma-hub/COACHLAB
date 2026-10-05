/**
 * The built-in drill library: original activities organized by skill and age.
 * Used by the Library page, by demo mode, and to ground AI generation.
 */
import type { Activity } from "../schema";
import { CLASSICS } from "./classics";
import { DEFENSE_REBOUNDING } from "./defenseRebounding";
import { CATEGORY_LABELS, type BuildContext, type Category, type LibraryEntry } from "./dsl";
import { OFFENSE } from "./offense";
import { PASSING_SHOOTING } from "./passingShooting";
import { SKILLS } from "./skills";
import { TRANSITION } from "./transition";

export { CATEGORIES, CATEGORY_LABELS, LIBRARY_ATTRIBUTION } from "./dsl";
export type { BuildContext, Category, LibraryEntry, Reference } from "./dsl";

export const LIBRARY: LibraryEntry[] = [...CLASSICS, ...SKILLS, ...PASSING_SHOOTING, ...DEFENSE_REBOUNDING, ...TRANSITION, ...OFFENSE];

export const ageLabel = (e: Pick<LibraryEntry, "ages">) => `Ages ${e.ages[0]}–${e.ages[1]}`;

/** Build an entry for browsing, using its default player count. */
export function buildEntry(entry: LibraryEntry, ctx: Partial<BuildContext> = {}): Activity {
  return entry.build({
    playerCount: Math.max(ctx.playerCount ?? entry.defaultPlayers, entry.minPlayers),
    level: ctx.level || ageLabel(entry),
    minutes: ctx.minutes ?? 10,
  });
}

/** Light stemming so "passing", "passes" and "pass" (or "cutting" and "cut") match. */
function stem(word: string): string {
  let w = word.replace(/(ing|ers|er|es|ed|s)$/, "") || word;
  if (/([b-df-hj-np-tv-z])\1$/.test(w)) w = w.slice(0, -1);
  if (w.length > 3 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}

/** Lowercase word tokens with light stemming ("passing" → "pass", "cuts" → "cut"). */
export function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9-]+/g) ?? [])
    // "box-out" and "out-of-bounds" match both as a whole and by their parts.
    .flatMap((w) => (w.includes("-") ? [w, ...w.split("-")] : [w]))
    .map(stem)
    .filter((w) => w.length > 1);
}

const STOP = new Set(["we", "have", "who", "need", "to", "the", "and", "for", "my", "our", "with", "on", "a", "an", "of", "in", "improve", "work", "team", "player", "kid", "drill", "want", "get", "better", "some"].map(stem));

/** Turn "8th grade", "U12", "12 year olds" into an approximate age. */
export function guessAge(text: string): number | undefined {
  const t = text.toLowerCase();
  const words: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12 };
  const grade = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+grade/) ?? t.match(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth)\s+grade/);
  if (grade) return (Number(grade[1]) || words[grade[1]]) + 5;
  const u = t.match(/\bu-?(\d{1,2})\b/) ?? t.match(/\b(\d{1,2})u\b/);
  if (u) return Number(u[1]) - 1;
  const range = t.match(/\bages?\s*(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\b/);
  if (range) return Math.round((Number(range[1]) + Number(range[2])) / 2);
  const single = t.match(/\bage(?:s|d)?\s*(\d{1,2})\b/);
  if (single) return Number(single[1]);
  const years = t.match(/\b(\d{1,2})[- ]?(?:year|yr)s?[- ]?olds?\b/);
  if (years) return Number(years[1]);
  if (/\b(varsity|high school|jv)\b/.test(t)) return 16;
  if (/\bmiddle school\b/.test(t)) return 13;
  return undefined;
}

export interface LibraryFilters {
  query?: string;
  category?: Category | "all";
  age?: number;
  court?: "half" | "full" | "any";
  players?: number;
}

export interface ScoredEntry {
  entry: LibraryEntry;
  score: number;
}

/** Score entries against a free-text query; higher is better. */
export function scoreEntry(entry: LibraryEntry, queryTokens: string[]): number {
  if (queryTokens.length === 0) return 0;
  const tags = new Set(entry.tags.flatMap((t) => tokens(t)));
  const title = new Set(tokens(entry.key.replace(/-/g, " ")));
  const cat = new Set(tokens(`${entry.category.replace(/-/g, " ")} ${CATEGORY_LABELS[entry.category]}`));
  let score = 0;
  for (const q of queryTokens) {
    if (STOP.has(q)) continue;
    if (tags.has(q)) score += 2;
    if (title.has(q)) score += 1.5;
    if (cat.has(q)) score += 1;
  }
  return score;
}

const courtCache = new Map<string, "half" | "full">();
/** Court size an entry uses (cached; building is cheap but not free). */
export function courtOf(entry: LibraryEntry): "half" | "full" {
  let c = courtCache.get(entry.key);
  if (!c) {
    c = buildEntry(entry).court;
    courtCache.set(entry.key, c);
  }
  return c;
}

export function searchLibrary(filters: LibraryFilters = {}): ScoredEntry[] {
  const q = tokens(filters.query ?? "");
  const results: ScoredEntry[] = [];
  for (const entry of LIBRARY) {
    if (filters.category && filters.category !== "all" && entry.category !== filters.category) continue;
    if (filters.age !== undefined && (filters.age < entry.ages[0] || filters.age > entry.ages[1])) continue;
    if (filters.players !== undefined && filters.players < entry.minPlayers) continue;
    if (filters.court && filters.court !== "any") {
      if (courtOf(entry) !== filters.court) continue;
    }
    const score = scoreEntry(entry, q);
    if (q.length > 0 && score === 0) continue;
    results.push({ entry, score });
  }
  results.sort((a, b) => b.score - a.score || LIBRARY.indexOf(a.entry) - LIBRARY.indexOf(b.entry));
  return results;
}

/**
 * Pick `count` entries for a coach's request: best matches first, preferring
 * different categories so suggestions take different approaches, and
 * skipping entries outside the stated age range or above the player count.
 */
export function pickForPrompt(prompt: string, opts: { count?: number; age?: number; players?: number; court?: "half" | "full" | "any" } = {}): LibraryEntry[] {
  const count = opts.count ?? 3;
  const age = opts.age ?? guessAge(prompt);
  const wantsFull = /\bfull[- ]court\b/i.test(prompt);
  const q = tokens(prompt);
  // Hard limits: roster size and court. Age is a soft preference so very young
  // or very old groups still get the closest-fitting drills.
  const pool = LIBRARY.filter(
    (e) => (opts.players === undefined || opts.players >= e.minPlayers) && (!opts.court || opts.court === "any" || courtOf(e) === opts.court),
  )
    .map((entry) => {
      const outside = age === undefined ? 0 : Math.max(entry.ages[0] - age, age - entry.ages[1], 0);
      return { entry, score: scoreEntry(entry, q) - outside * 3 + (wantsFull && courtOf(entry) === "full" ? 2 : 0) };
    })
    .sort((a, b) => b.score - a.score || LIBRARY.indexOf(a.entry) - LIBRARY.indexOf(b.entry));
  const picked: LibraryEntry[] = [];
  const usedCats = new Set<Category>();
  for (const { entry, score } of pool) {
    if (picked.length >= count) break;
    if (usedCats.has(entry.category) && score < (pool[0]?.score ?? 0)) continue;
    picked.push(entry);
    usedCats.add(entry.category);
  }
  for (const { entry } of pool) {
    if (picked.length >= count) break;
    if (!picked.includes(entry)) picked.push(entry);
  }
  return picked;
}
