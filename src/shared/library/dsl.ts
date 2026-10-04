/**
 * Building blocks for the built-in drill library. Every library activity is an
 * original write-up in our own words with our own court diagram; `references`
 * point to public coaching pages for further reading, not to a source we copied.
 */
import type { Action, Activity, Player, Step } from "../schema";

export interface BuildContext {
  playerCount: number;
  level: string;
  minutes: number;
}

export const CATEGORIES = [
  "warmup",
  "ball-handling",
  "passing",
  "shooting",
  "finishing",
  "footwork",
  "rebounding",
  "defense",
  "transition",
  "team-offense",
  "special-situations",
  "games",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  warmup: "Warm-ups",
  "ball-handling": "Ball handling",
  passing: "Passing",
  shooting: "Shooting",
  finishing: "Finishing",
  footwork: "Footwork",
  rebounding: "Rebounding",
  defense: "Defense",
  transition: "Transition",
  "team-offense": "Team offense & plays",
  "special-situations": "Inbounds & press break",
  games: "Games",
};

export interface Reference {
  title: string;
  url: string;
}

export interface LibraryEntry {
  key: string;
  category: Category;
  /** Search words: skills, concepts and synonyms coaches use. */
  tags: string[];
  /** Suggested age range, inclusive. */
  ages: [number, number];
  /** Fewest players the activity needs. */
  minPlayers: number;
  /** Player count used when browsing the library. */
  defaultPlayers: number;
  references: Reference[];
  build: (ctx: BuildContext) => Activity;
}

export const LIBRARY_ATTRIBUTION =
  "Original Driven Play Lab library activity, written from common coaching practice. Not attributed to, or endorsed by, any NBA, WNBA, college or USA Basketball program.";

let seq = 0;
const aid = () => `a${++seq}`;

export const P = (id: string, label: string, role: Player["role"], x: number, y: number, name: string | null = null): Player => ({
  id,
  label,
  role,
  x,
  y,
  name,
});

export const move = (
  type: "cut" | "dribble" | "screen" | "move",
  playerId: string,
  x: number,
  y: number,
  delay: number,
  duration: number,
  opts: { via?: [number, number]; targetId?: string } = {},
): Action => ({
  id: aid(),
  type,
  playerId,
  to: { x, y },
  via: opts.via ? { x: opts.via[0], y: opts.via[1] } : null,
  targetId: opts.targetId ?? null,
  delay,
  duration,
});

export const pass = (from: string, to: string, delay: number, duration = 0.7): Action => ({
  id: aid(),
  type: "pass",
  playerId: from,
  to: null,
  via: null,
  targetId: to,
  delay,
  duration,
});

export const shot = (from: string, rebounder: string | null, delay: number, duration = 1): Action => ({
  id: aid(),
  type: "shot",
  playerId: from,
  to: null,
  via: null,
  targetId: rebounder,
  delay,
  duration,
});

export const step = (label: string, note: string, duration: number, actions: Action[]): Step => ({
  id: `s${++seq}`,
  label,
  note,
  duration,
  actions,
});

/**
 * Waiting players in a line, starting at index `from` (1-based labels).
 * A line that would leave the court wraps into a second (third…) column
 * beside the first, toward the middle of the floor, so big rosters stay on court.
 */
export function line(
  prefix: string,
  role: Player["role"],
  from: number,
  count: number,
  x: number,
  y: number,
  dx: number,
  dy: number,
  lineName: string,
  maxY = 47,
): Player[] {
  const inside = (px: number, py: number) => px >= 1 && px <= 49 && py >= 0.5 && py <= maxY - 0.5;
  const len = Math.hypot(dx, dy);
  let perp = len ? { x: (-dy / len) * 2.8, y: (dx / len) * 2.8 } : { x: 2.8, y: 0 };
  // Wrap toward the middle of the court.
  const toCenter = (25 - x) * perp.x + (maxY / 2 - y) * perp.y;
  if (toCenter < 0) perp = { x: -perp.x, y: -perp.y };
  const out: Player[] = [];
  let col = 0;
  let k = 0;
  for (let i = 0; i < count; i++) {
    let px = x + perp.x * col + dx * k;
    let py = y + perp.y * col + dy * k;
    if (k > 0 && !inside(px, py)) {
      col++;
      k = 0;
      px = x + perp.x * col;
      py = y + perp.y * col;
    }
    const n = from + i;
    out.push(P(`${prefix}${n}`, `${prefix}${n}`, role, Math.round(px * 10) / 10, Math.round(py * 10) / 10, `${lineName} #${n}`));
    k++;
  }
  return out;
}

/** Split n players into `parts` groups as evenly as possible. */
export const split = (n: number, parts: number) => {
  const b = Math.floor(n / parts);
  return Array.from({ length: parts }, (_, i) => b + (i < n % parts ? 1 : 0));
};

/** Bench / next-group players along half court, at most 10 shown. */
export const bench = (count: number, y = 46) => line("N", "neutral", 1, Math.max(0, Math.min(count, 10)), 2, y, 4, 0, "Next group");

/** Shared defaults for every library activity. */
export function base(ctx: BuildContext) {
  return {
    level: ctx.level,
    playerCount: ctx.playerCount,
    durationMinutes: Math.min(ctx.minutes, 15),
    attribution: LIBRARY_ATTRIBUTION,
  };
}
