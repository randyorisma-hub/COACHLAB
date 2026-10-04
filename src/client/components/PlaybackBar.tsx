import { SPEEDS, type Playback } from "../usePlayback";
import type { Timeline } from "../../shared/engine";

export function PlaybackBar({ pb, timeline, stepIndex }: { pb: Playback; timeline: Timeline; stepIndex: number }) {
  const { total } = timeline;
  const steps = timeline.activity.steps;
  return (
    <div className="playback" role="group" aria-label="Playback controls">
      <div className="playback-buttons">
        <button type="button" className="icon-btn" onClick={pb.restart} aria-label="Restart" title="Restart">
          ⏮
        </button>
        <button type="button" className="icon-btn" onClick={pb.prevStep} aria-label="Previous step" title="Previous step">
          ◀︎
        </button>
        <button
          type="button"
          className="icon-btn icon-btn--primary"
          onClick={pb.toggle}
          aria-label={pb.playing ? "Pause" : "Play"}
          title={pb.playing ? "Pause" : "Play"}
          disabled={total <= 0}
        >
          {pb.playing ? "❚❚" : "▶"}
        </button>
        <button type="button" className="icon-btn" onClick={pb.nextStep} aria-label="Next step" title="Next step">
          ▶︎|
        </button>
        <label className="speed">
          <span className="sr-only">Speed</span>
          <select value={pb.speed} onChange={(e) => pb.setSpeed(Number(e.target.value))} aria-label="Playback speed">
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </label>
        <label className="loop" title="Loop">
          <input type="checkbox" checked={pb.loop} onChange={(e) => pb.setLoop(e.target.checked)} /> Loop
        </label>
      </div>
      <div className="scrubber">
        <input
          type="range"
          min={0}
          max={Math.max(total, 0.01)}
          step={0.01}
          value={pb.time}
          onChange={(e) => {
            pb.pause();
            pb.seek(Number(e.target.value));
          }}
          aria-label="Timeline"
        />
        <div className="ticks" aria-hidden="true">
          {timeline.stepStarts.map((s, i) => (
            <span key={i} style={{ left: `${total ? (s / total) * 100 : 0}%` }} />
          ))}
        </div>
      </div>
      <div className="playback-status">
        <span>
          {stepIndex >= 0 ? `Step ${stepIndex + 1}/${steps.length}: ${steps[stepIndex].label}` : "Setup"}
        </span>
        <span className="mono">
          {pb.time.toFixed(1)}s / {total.toFixed(1)}s
        </span>
      </div>
    </div>
  );
}
