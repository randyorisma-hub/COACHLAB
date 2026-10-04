import { enforceAttribution } from "./attribution";
import type { Activity, ActivityEnvelope, Origin } from "./schema";
import { findIssues, normalizeActivity } from "./validate";

/**
 * Normalize an activity, apply the attribution guardrail to generated content
 * (a coach's own manual activity keeps their wording) and collect issues.
 */
export function prepareActivity(raw: Activity, origin: Origin): ActivityEnvelope {
  const { activity: normalized, fixes } = normalizeActivity(raw);
  const { activity, notes } =
    origin === "manual" ? { activity: normalized, notes: [] } : enforceAttribution(normalized);
  return { activity, origin, warnings: [...fixes, ...notes, ...findIssues(activity)] };
}
