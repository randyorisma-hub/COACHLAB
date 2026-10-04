import { useMemo, useState } from "react";
import { buildTimeline, frameAt } from "../../shared/engine";
import type { ActivityEnvelope } from "../../shared/schema";
import { api, ApiError, type Mode } from "../api";
import { Court } from "./Court";
import { OriginBadge } from "./Badges";

export interface CreateState {
  prompt: string;
  playerCount: string;
  level: string;
  minutes: string;
  court: "any" | "half" | "full";
  suggestions: ActivityEnvelope[];
  resultMode: Mode | null;
}

export const initialCreateState: CreateState = {
  prompt: "",
  playerCount: "",
  level: "",
  minutes: "",
  court: "any",
  suggestions: [],
  resultMode: null,
};

const EXAMPLES = [
  "We have 12 eighth graders who need to improve passing and cutting.",
  "A simple pick-and-roll read for my JV guards and bigs.",
  "Our help defense is late on skip passes. 10 players, 15 minutes.",
  "Fast-paced full-court warm-up with layups for U12 girls.",
];

type Phase = "text" | "import" | "footage";

export function CreateView({
  state,
  setState,
  onOpen,
  onBlank,
}: {
  state: CreateState;
  setState: (s: CreateState) => void;
  onOpen: (env: ActivityEnvelope) => void;
  onBlank: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("text");

  const generate = async () => {
    if (state.prompt.trim().length < 3 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const team = {
        playerCount: state.playerCount ? Number(state.playerCount) : undefined,
        level: state.level.trim() || undefined,
        minutes: state.minutes ? Number(state.minutes) : undefined,
        court: state.court,
      };
      const res = await api.generate({ prompt: state.prompt.trim(), team });
      setState({ ...state, suggestions: res.suggestions, resultMode: res.mode });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Generation failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="create">
      <section className="panel hero">
        <div className="phase-tabs" role="tablist" aria-label="Input type">
          <button type="button" role="tab" aria-selected={phase === "text"} className={`tab ${phase === "text" ? "tab--active" : ""}`} onClick={() => setPhase("text")}>
            Describe it
          </button>
          <button type="button" role="tab" aria-selected={phase === "import"} className={`tab ${phase === "import" ? "tab--active" : ""}`} onClick={() => setPhase("import")}>
            Screenshot / PDF <span className="soon">Phase 2</span>
          </button>
          <button type="button" role="tab" aria-selected={phase === "footage"} className={`tab ${phase === "footage" ? "tab--active" : ""}`} onClick={() => setPhase("footage")}>
            Game footage <span className="soon">Phase 3</span>
          </button>
        </div>

        {phase === "text" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void generate();
            }}
          >
            <label className="field">
              <span>What does your team need?</span>
              <textarea
                rows={3}
                maxLength={2000}
                value={state.prompt}
                placeholder="Describe a drill, play, or team need…"
                onChange={(e) => setState({ ...state, prompt: e.target.value })}
              />
            </label>
            <div className="examples">
              {EXAMPLES.map((ex) => (
                <button key={ex} type="button" className="chip" onClick={() => setState({ ...state, prompt: ex })}>
                  {ex}
                </button>
              ))}
            </div>
            <div className="row wrap team-fields">
              <label className="field narrow">
                <span>Players</span>
                <input type="number" min={1} max={40} inputMode="numeric" value={state.playerCount} onChange={(e) => setState({ ...state, playerCount: e.target.value })} />
              </label>
              <label className="field grow">
                <span>Age / level</span>
                <input value={state.level} maxLength={100} placeholder="e.g. 8th grade boys" onChange={(e) => setState({ ...state, level: e.target.value })} />
              </label>
              <label className="field narrow">
                <span>Minutes</span>
                <input type="number" min={1} max={180} inputMode="numeric" value={state.minutes} onChange={(e) => setState({ ...state, minutes: e.target.value })} />
              </label>
              <label className="field narrow">
                <span>Court</span>
                <select value={state.court} onChange={(e) => setState({ ...state, court: e.target.value as CreateState["court"] })}>
                  <option value="any">Any</option>
                  <option value="half">Half</option>
                  <option value="full">Full</option>
                </select>
              </label>
            </div>
            <div className="row wrap">
              <button type="submit" className="btn btn--primary btn--big" disabled={busy || state.prompt.trim().length < 3}>
                {busy ? "Designing 3 suggestions…" : "Generate 3 suggestions"}
              </button>
              <button type="button" className="btn btn--ghost" onClick={onBlank}>
                Start from a blank court
              </button>
              <a className="btn btn--ghost" href="#/library">
                Browse the drill library
              </a>
            </div>
            {busy && <p className="hint">AI design can take up to a minute.</p>}
            {error && <p className="error">{error}</p>}
          </form>
        ) : (
          <div className="coming-soon">
            {phase === "import" ? (
              <>
                <h3>Import a screenshot or PDF — coming in Phase 2</h3>
                <p>Upload a whiteboard photo, a diagram screenshot or a PDF playbook page and Driven Play Lab will convert it into editable players and actions.</p>
              </>
            ) : (
              <>
                <h3>Reconstruct from game footage — coming in Phase 3</h3>
                <p>Upload a clip and Driven Play Lab will reconstruct player movement into an editable, animated diagram.</p>
              </>
            )}
            <p className="hint">Not available yet. Use “Describe it” for now.</p>
          </div>
        )}
      </section>

      {state.suggestions.length > 0 && (
        <section className="suggestions" aria-label="Suggestions">
          <h2>
            {state.suggestions.length} suggestions {state.resultMode === "demo" && <span className="badge badge--demo">DEMO samples</span>}
          </h2>
          <div className="suggestion-grid">
            {state.suggestions.map((s) => (
              <SuggestionCard key={s.activity.id} env={s} onOpen={() => onOpen(s)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SuggestionCard({ env, onOpen }: { env: ActivityEnvelope; onOpen: () => void }) {
  const { activity } = env;
  const timeline = useMemo(() => buildTimeline(activity), [activity]);
  // Preview the end of the first step so the card shows the key action.
  const frame = frameAt(timeline, 0);
  return (
    <article className="panel suggestion">
      <button type="button" className="suggestion-court" onClick={onOpen} aria-label={`Open ${activity.title}`}>
        <Court timeline={timeline} frame={frame} pathStep={activity.steps.length ? 0 : -1} />
      </button>
      <div className="suggestion-body">
        <div className="row space">
          <span className="kind">{activity.kind}</span>
          <OriginBadge origin={env.origin} />
        </div>
        <h3>{activity.title}</h3>
        <p>{activity.summary}</p>
        <p className="meta">
          {activity.players.length} players · {activity.durationMinutes} min · {activity.court} court · {activity.steps.length} steps
        </p>
        {env.warnings.length > 0 && <p className="warn">{env.warnings.length} note(s) to review in the editor</p>}
        <button type="button" className="btn btn--primary" onClick={onOpen}>
          Open & animate
        </button>
      </div>
    </article>
  );
}
