import { z } from "zod";

/**
 * Court coordinate system (feet), shared by the AI prompt, the animation
 * engine and the renderer:
 *   x: 0 (left sideline) .. 50 (right sideline)
 *   y: 0 (baseline under the hoop) .. 47 (half-court line) for a half court,
 *      0 .. 94 (far baseline) for a full court.
 * The hoop the offense attacks sits at (25, 5.25).
 */
export const COURT_WIDTH = 50;
export const HALF_COURT_LENGTH = 47;
export const FULL_COURT_LENGTH = 94;
export const HOOP = { x: 25, y: 5.25 } as const;

export const ACTION_TYPES = ["cut", "dribble", "pass", "screen", "move", "shot"] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

/** Actions that relocate the acting player. */
export const MOVEMENT_TYPES: readonly ActionType[] = ["cut", "dribble", "screen", "move"];
/** Actions that relocate the ball away from the acting player. */
export const BALL_TRANSFER_TYPES: readonly ActionType[] = ["pass", "shot"];

export const ROLES = ["offense", "defense", "coach", "neutral"] as const;
export type Role = (typeof ROLES)[number];

export const PointSchema = z.object({ x: z.number(), y: z.number() });
export type Point = z.infer<typeof PointSchema>;

export const PlayerSchema = z.object({
  id: z.string().describe("Unique, stable id, e.g. 'O1', 'X2', 'C'"),
  label: z.string().describe("Short on-court label (1-3 chars), e.g. '1', 'X2', 'C'"),
  name: z.string().nullable().describe("Optional longer description, e.g. 'Point guard' or 'Line A #2'"),
  role: z.enum(ROLES),
  x: z.number(),
  y: z.number(),
});
export type Player = z.infer<typeof PlayerSchema>;

export const ActionSchema = z.object({
  id: z.string(),
  type: z.enum(ACTION_TYPES),
  playerId: z.string().describe("The acting player. For pass/shot, the player releasing the ball."),
  to: PointSchema.nullable().describe("Destination for cut/dribble/screen/move. Null for pass/shot."),
  via: PointSchema.nullable().describe("Optional curve control point for curved paths (curls, banana cuts)."),
  targetId: z
    .string()
    .nullable()
    .describe("pass: receiving player id. shot: rebounder id or null. screen: player being screened for, or null."),
  delay: z.number().describe("Seconds after the step starts that this action begins"),
  duration: z.number().describe("Seconds the action takes"),
});
export type Action = z.infer<typeof ActionSchema>;

export const StepSchema = z.object({
  id: z.string(),
  label: z.string().describe("Short name for the phase, e.g. 'Entry pass'"),
  note: z.string().describe("What the coach should watch for in this phase"),
  duration: z.number().describe("Seconds this phase lasts"),
  actions: z.array(ActionSchema),
});
export type Step = z.infer<typeof StepSchema>;

export const ActivitySchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: z.enum(["drill", "play", "warmup", "game"]),
  summary: z.string(),
  objectives: z.array(z.string()),
  level: z.string().describe("Age / level the activity is designed for"),
  playerCount: z.number(),
  durationMinutes: z.number(),
  court: z.enum(["half", "full"]),
  equipment: z.array(z.string()),
  setup: z.array(z.string()),
  instructions: z.array(z.string()),
  rotations: z.array(z.string()),
  coachingCues: z.array(z.string()),
  variations: z.array(z.string()),
  players: z.array(PlayerSchema),
  ballStart: z.string().nullable().describe("Player id holding the ball at the start, or null"),
  steps: z.array(StepSchema),
  attribution: z.string().describe("Source statement. Generated content must say it is an original design."),
});
export type Activity = z.infer<typeof ActivitySchema>;

/** What the model returns for a generation request. */
export const SuggestionSetSchema = z.object({
  suggestions: z.array(ActivitySchema).describe("Exactly three distinct suggestions"),
});

/** What the model returns for a revision request. */
export const RevisionSchema = z.object({
  activity: ActivitySchema,
  changeSummary: z.string().describe("One or two sentences describing what changed"),
});

export type Origin = "ai" | "demo" | "manual";

/** An activity plus provenance metadata the app (not the model) controls. */
export interface ActivityEnvelope {
  activity: Activity;
  origin: Origin;
  warnings: string[];
}

export const GenerateRequestSchema = z.object({
  prompt: z.string().trim().min(3).max(2000),
  team: z
    .object({
      playerCount: z.number().int().min(1).max(40).optional(),
      level: z.string().max(100).optional(),
      minutes: z.number().int().min(1).max(180).optional(),
      court: z.enum(["half", "full", "any"]).optional(),
    })
    .optional(),
});
export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

export const ReviseRequestSchema = z.object({
  activity: ActivitySchema,
  instruction: z.string().trim().min(2).max(1000),
});
export type ReviseRequest = z.infer<typeof ReviseRequestSchema>;

export interface SavedActivity {
  id: string;
  activity: Activity;
  origin: Origin;
  savedAt: string;
}

export interface PlaybookPublic {
  id: string;
  name: string;
  team: string;
  createdAt: string;
  updatedAt: string;
  activities: SavedActivity[];
}

export interface PlaybookOwnerView extends PlaybookPublic {
  shareId: string;
}

export const CreatePlaybookSchema = z.object({
  name: z.string().trim().min(1).max(120),
  team: z.string().trim().max(120).default(""),
});

export const SaveActivitySchema = z.object({
  activity: ActivitySchema,
  origin: z.enum(["ai", "demo", "manual"]),
});
