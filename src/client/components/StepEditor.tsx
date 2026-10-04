import { ACTION_TYPES, MOVEMENT_TYPES, ROLES, type ActionType, type Activity } from "../../shared/schema";
import {
  addAction,
  addPlayer,
  addStep,
  moveStep,
  removeAction,
  removePlayer,
  removeStep,
  toggleCurve,
  updateAction,
  updatePlayer,
  updateStep,
} from "../../shared/edit";

interface Props {
  activity: Activity;
  /** -1 = setup (starting positions). */
  selectedStep: number;
  selectedActionId: string | null;
  onChange: (next: Activity) => void;
  onSelectStep: (index: number) => void;
  onSelectAction: (id: string | null) => void;
}

const num = (v: string, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : fallback;
};

export function StepEditor({ activity, selectedStep, selectedActionId, onChange, onSelectStep, onSelectAction }: Props) {
  const step = selectedStep >= 0 ? activity.steps[selectedStep] : undefined;
  const label = (id: string | null) => activity.players.find((p) => p.id === id)?.label ?? "—";
  const playerOptions = activity.players.map((p) => (
    <option key={p.id} value={p.id}>
      {p.label}
      {p.name ? ` · ${p.name}` : ""}
    </option>
  ));

  return (
    <section className="panel step-editor" aria-label="Timeline editor">
      <div className="step-chips" role="tablist" aria-label="Steps">
        <button type="button" role="tab" aria-selected={selectedStep === -1} className={`chip ${selectedStep === -1 ? "chip--active" : ""}`} onClick={() => onSelectStep(-1)}>
          Setup
        </button>
        {activity.steps.map((s, i) => (
          <button key={s.id} type="button" role="tab" aria-selected={selectedStep === i} className={`chip ${selectedStep === i ? "chip--active" : ""}`} onClick={() => onSelectStep(i)}>
            {i + 1}. {s.label}
          </button>
        ))}
        <button
          type="button"
          className="chip chip--add"
          onClick={() => {
            const after = selectedStep >= 0 ? selectedStep : activity.steps.length - 1;
            onChange(addStep(activity, after));
            onSelectStep(after + 1);
          }}
        >
          + Step
        </button>
      </div>

      {!step ? (
        <div className="setup-editor">
          <p className="hint">Drag players on the court to set starting spots.</p>
          <div className="row">
            <label className="field inline">
              <span>Ball starts with</span>
              <select value={activity.ballStart ?? ""} onChange={(e) => onChange({ ...activity, ballStart: e.target.value || null })}>
                <option value="">Nobody</option>
                {playerOptions}
              </select>
            </label>
            <label className="field inline">
              <span>Court</span>
              <select value={activity.court} onChange={(e) => onChange({ ...activity, court: e.target.value as Activity["court"] })}>
                <option value="half">Half</option>
                <option value="full">Full</option>
              </select>
            </label>
          </div>
          <table className="players-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Name / spot</th>
                <th>Role</th>
                <th aria-label="Remove" />
              </tr>
            </thead>
            <tbody>
              {activity.players.map((p) => (
                <tr key={p.id}>
                  <td>
                    <input className="w-label" maxLength={3} value={p.label} onChange={(e) => onChange(updatePlayer(activity, p.id, { label: e.target.value }))} aria-label={`Label for ${p.label}`} />
                  </td>
                  <td>
                    <input value={p.name ?? ""} onChange={(e) => onChange(updatePlayer(activity, p.id, { name: e.target.value || null }))} aria-label={`Name for ${p.label}`} />
                  </td>
                  <td>
                    <select value={p.role} onChange={(e) => onChange(updatePlayer(activity, p.id, { role: e.target.value as (typeof ROLES)[number] }))} aria-label={`Role for ${p.label}`}>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button type="button" className="icon-btn icon-btn--small" onClick={() => onChange(removePlayer(activity, p.id))} aria-label={`Remove ${p.label}`}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="row">
            {(["offense", "defense", "coach"] as const).map((r) => (
              <button key={r} type="button" className="btn btn--ghost" onClick={() => onChange(addPlayer(activity, r))}>
                + {r === "offense" ? "Offense" : r === "defense" ? "Defender" : "Coach"}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="step-detail">
          <div className="row">
            <label className="field grow">
              <span>Step name</span>
              <input value={step.label} onChange={(e) => onChange(updateStep(activity, selectedStep, { label: e.target.value }))} />
            </label>
            <label className="field narrow">
              <span>Seconds</span>
              <input
                type="number"
                min={0.5}
                step={0.1}
                value={step.duration}
                onChange={(e) => onChange(updateStep(activity, selectedStep, { duration: Math.max(num(e.target.value, step.duration), 0.5) }))}
              />
            </label>
          </div>
          <label className="field">
            <span>Coaching note</span>
            <input value={step.note} onChange={(e) => onChange(updateStep(activity, selectedStep, { note: e.target.value }))} />
          </label>

          <ul className="actions-list">
            {step.actions.map((a) => {
              const selected = a.id === selectedActionId;
              const isMove = MOVEMENT_TYPES.includes(a.type);
              return (
                <li key={a.id} className={`action-row action-row--${a.type} ${selected ? "action-row--selected" : ""}`} onClick={() => onSelectAction(a.id)}>
                  <div className="action-main">
                    <select value={a.type} onChange={(e) => onChange(updateAction(activity, selectedStep, a.id, { type: e.target.value as ActionType }))} aria-label="Action type">
                      {ACTION_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <select value={a.playerId} onChange={(e) => onChange(updateAction(activity, selectedStep, a.id, { playerId: e.target.value }))} aria-label="Player">
                      {playerOptions}
                    </select>
                    {(a.type === "pass" || a.type === "shot" || a.type === "screen") && (
                      <>
                        <span className="arrow-word">{a.type === "pass" ? "to" : a.type === "shot" ? "rebound" : "for"}</span>
                        <select
                          value={a.targetId ?? ""}
                          onChange={(e) => onChange(updateAction(activity, selectedStep, a.id, { targetId: e.target.value || null }))}
                          aria-label={a.type === "pass" ? "Receiver" : a.type === "shot" ? "Rebounder" : "Screen for"}
                        >
                          {a.type !== "pass" && <option value="">—</option>}
                          {activity.players
                            .filter((p) => p.id !== a.playerId)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.label}
                              </option>
                            ))}
                        </select>
                      </>
                    )}
                  </div>
                  <div className="action-timing">
                    <label>
                      start
                      <input type="number" min={0} step={0.1} value={a.delay} onChange={(e) => onChange(updateAction(activity, selectedStep, a.id, { delay: num(e.target.value, a.delay) }))} />s
                    </label>
                    <label>
                      takes
                      <input
                        type="number"
                        min={0.2}
                        step={0.1}
                        value={a.duration}
                        onChange={(e) => onChange(updateAction(activity, selectedStep, a.id, { duration: Math.max(num(e.target.value, a.duration), 0.2) }))}
                      />
                      s
                    </label>
                    {isMove && (
                      <button type="button" className="btn btn--tiny" onClick={() => onChange(toggleCurve(activity, selectedStep, a.id))} title="Curve the path">
                        {a.via ? "Straighten" : "Curve"}
                      </button>
                    )}
                    <button
                      type="button"
                      className="icon-btn icon-btn--small"
                      aria-label={`Remove ${a.type} by ${label(a.playerId)}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onChange(removeAction(activity, selectedStep, a.id));
                        onSelectAction(null);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="hint">Tip: drag a player to create a cut (or a dribble for the ball handler); drag the ◆ handle to change where a path ends.</p>
          <div className="row wrap">
            {ACTION_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                className={`btn btn--ghost btn--${t}`}
                onClick={() => {
                  const player = activity.players.find((p) => p.role !== "neutral") ?? activity.players[0];
                  if (!player) return;
                  const res = addAction(activity, selectedStep, t, player.id);
                  onChange(res.activity);
                  onSelectAction(res.actionId);
                }}
              >
                + {t}
              </button>
            ))}
          </div>
          <div className="row step-ops">
            <button type="button" className="btn btn--ghost" onClick={() => { onChange(moveStep(activity, selectedStep, -1)); onSelectStep(Math.max(selectedStep - 1, 0)); }} disabled={selectedStep === 0}>
              ← Earlier
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => { onChange(moveStep(activity, selectedStep, 1)); onSelectStep(Math.min(selectedStep + 1, activity.steps.length - 1)); }} disabled={selectedStep === activity.steps.length - 1}>
              Later →
            </button>
            <button type="button" className="btn btn--danger" onClick={() => { onChange(removeStep(activity, selectedStep)); onSelectStep(Math.min(selectedStep, activity.steps.length - 2)); }}>
              Delete step
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
