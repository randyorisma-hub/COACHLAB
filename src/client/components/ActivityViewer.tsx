import { useMemo, type ReactNode } from "react";
import { buildTimeline, frameAt } from "../../shared/engine";
import type { Activity, Origin } from "../../shared/schema";
import { usePlayback } from "../usePlayback";
import { Court, Legend } from "./Court";
import { DetailsPanel } from "./DetailsPanel";
import { OriginBadge } from "./Badges";
import { PlaybackBar } from "./PlaybackBar";

/** Read-only animated view used by shared links and the library. */
export function ActivityViewer({ activity, origin, aside }: { activity: Activity; origin: Origin; aside?: ReactNode }) {
  const timeline = useMemo(() => buildTimeline(activity), [activity]);
  const pb = usePlayback(timeline);
  const frame = frameAt(timeline, pb.time);
  const step = frame.stepIndex >= 0 ? activity.steps[frame.stepIndex] : undefined;
  return (
    <div className="workspace">
      <div className="stage">
        <header className="activity-head">
          <h2>{activity.title}</h2>
          <OriginBadge origin={origin} />
        </header>
        <Court timeline={timeline} frame={frame} pathStep={frame.stepIndex} />
        <PlaybackBar pb={pb} timeline={timeline} stepIndex={frame.stepIndex} />
        {step?.note && <p className="step-note">{step.note}</p>}
        <Legend />
      </div>
      <div className="side">
        {aside}
        <DetailsPanel activity={activity} readOnly />
      </div>
    </div>
  );
}
