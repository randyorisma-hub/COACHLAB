import { useEffect, useMemo, useRef, useState } from "react";
import { buildTimeline, frameAt, stepIndexAt } from "../../shared/engine";
import { dragPlayerInStep, setActionPoint, setPlayerStart } from "../../shared/edit";
import { findIssues, normalizeActivity } from "../../shared/validate";
import type { Activity, Origin, Point } from "../../shared/schema";
import { api, ApiError, shareUrl, type Mode } from "../api";
import type { OwnedPlaybook } from "../storage";
import { usePlayback } from "../usePlayback";
import { Court, Legend, type DragTarget } from "./Court";
import { DetailsPanel } from "./DetailsPanel";
import { OriginBadge } from "./Badges";
import { PlaybackBar } from "./PlaybackBar";
import { StepEditor } from "./StepEditor";

export interface WorkingCopy {
  activity: Activity;
  origin: Origin;
  /** Where it was last saved, so re-saving updates it. */
  savedTo?: { playbookId: string; savedId: string };
}

interface Props {
  working: WorkingCopy;
  mode: Mode | null;
  owned: OwnedPlaybook[];
  onChange: (w: WorkingCopy) => void;
  onCreatePlaybook: (name: string) => Promise<OwnedPlaybook>;
}

const QUICK_CHANGES = ["Slow it down for beginners", "Add a passive defender", "Make it competitive with scoring", "Mirror it to the other side"];

export function ActivityEditor({ working, mode, owned, onChange, onCreatePlaybook }: Props) {
  const { activity, origin } = working;
  const [history, setHistory] = useState<Activity[]>([]);
  const [future, setFuture] = useState<Activity[]>([]);
  const [setupMode, setSetupMode] = useState(true);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const dragSession = useRef<{ pushed: boolean; actionId?: string } | null>(null);

  const timeline = useMemo(() => buildTimeline(activity), [activity]);
  const pb = usePlayback(timeline);
  const frame = frameAt(timeline, pb.time);
  // Setup (starting positions) is only editable at time 0; once the clock moves, edits apply to the current step.
  const inSetup = (setupMode && pb.time === 0) || activity.steps.length === 0;
  const editingStep = inSetup ? -1 : stepIndexAt(timeline, pb.time);
  const pathStep = pb.playing ? frame.stepIndex : editingStep;
  const issues = useMemo(() => findIssues(normalizeActivity(activity).activity), [activity]);

  // Changing activities (e.g. opening another one) resets local editor state.
  const activityId = activity.id;
  useEffect(() => {
    setHistory([]);
    setFuture([]);
    setSetupMode(true);
    setSelectedActionId(null);
    pb.restart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityId]);

  const commit = (next: Activity, opts: { record?: boolean } = {}) => {
    if (opts.record !== false) {
      setHistory((h) => [...h.slice(-49), activity]);
      setFuture([]);
    }
    onChange({ ...working, activity: next });
  };

  const undo = () => {
    const prev = history.at(-1);
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setFuture((f) => [activity, ...f]);
    onChange({ ...working, activity: prev });
  };
  const redo = () => {
    const next = future[0];
    if (!next) return;
    setFuture((f) => f.slice(1));
    setHistory((h) => [...h, activity]);
    onChange({ ...working, activity: next });
  };

  const selectStep = (i: number) => {
    pb.pause();
    setSelectedActionId(null);
    if (i < 0) {
      setSetupMode(true);
      pb.seek(0);
    } else {
      setSetupMode(false);
      pb.seek(timeline.stepStarts[i] ?? 0);
    }
  };

  const onDrag = (target: DragTarget, p: Point, phase: "move" | "end") => {
    if (!dragSession.current) dragSession.current = { pushed: false };
    const session = dragSession.current;
    const record = !session.pushed;
    session.pushed = true;
    if (target.kind === "player") {
      if (editingStep < 0) commit(setPlayerStart(activity, target.id, p), { record });
      else {
        const res = dragPlayerInStep(activity, editingStep, target.id, p);
        setSelectedActionId(res.actionId);
        commit(res.activity, { record });
      }
    } else {
      commit(setActionPoint(activity, target.stepIndex, target.actionId, target.kind, p), { record });
    }
    if (phase === "end") dragSession.current = null;
  };

  return (
    <div className="workspace">
      <div className="stage">
        <header className="activity-head">
          <input className="title-input" value={activity.title} onChange={(e) => commit({ ...activity, title: e.target.value })} aria-label="Activity title" />
          <OriginBadge origin={origin} />
        </header>
        <Court
          timeline={timeline}
          frame={frame}
          pathStep={pathStep}
          editable={!pb.playing}
          selectedActionId={selectedActionId}
          onDrag={onDrag}
          onSelectAction={(_, id) => setSelectedActionId(id)}
        />
        <PlaybackBar pb={pb} timeline={timeline} stepIndex={frame.stepIndex} />
        <div className="row edit-row">
          <button type="button" className="btn btn--ghost" onClick={undo} disabled={!history.length}>
            ↶ Undo
          </button>
          <button type="button" className="btn btn--ghost" onClick={redo} disabled={!future.length}>
            ↷ Redo
          </button>
          <span className="hint">{pb.playing ? "Pause to edit." : editingStep < 0 ? "Editing starting positions." : `Editing step ${editingStep + 1}.`}</span>
        </div>
        <Legend />
        {issues.length > 0 && (
          <div className="issues" role="alert">
            <strong>Check the ball:</strong>
            <ul>
              {issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="side">
        <RevisePanel
          activity={activity}
          mode={mode}
          issues={issues}
          onRevised={(next, newOrigin) => {
            commit(next);
            if (newOrigin !== origin) onChange({ ...working, activity: next, origin: newOrigin });
          }}
        />
        <StepEditor
          activity={activity}
          selectedStep={editingStep}
          selectedActionId={selectedActionId}
          onChange={(next) => commit(next)}
          onSelectStep={selectStep}
          onSelectAction={setSelectedActionId}
        />
        <DetailsPanel activity={activity} onChange={(next) => commit(next)} />
        <SavePanel working={working} owned={owned} onSaved={onChange} onCreatePlaybook={onCreatePlaybook} />
      </div>
    </div>
  );
}

function RevisePanel({
  activity,
  mode,
  issues,
  onRevised,
}: {
  activity: Activity;
  mode: Mode | null;
  issues: string[];
  onRevised: (a: Activity, origin: Origin) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const submit = async (instruction: string) => {
    if (!instruction.trim() || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await api.revise(normalizeActivity(activity).activity, instruction.trim());
      onRevised(res.result.activity, res.mode === "demo" ? "demo" : "ai");
      setMessage({ kind: "ok", text: res.changeSummary });
      setText("");
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof ApiError ? err.message : "Revision failed." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel revise">
      <h3>Change it in plain language</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(text);
        }}
      >
        <textarea
          rows={2}
          value={text}
          maxLength={1000}
          placeholder="e.g. “Add a skip pass to the weak-side corner and have 4 screen for 2.”"
          onChange={(e) => setText(e.target.value)}
        />
        <div className="row wrap">
          <button type="submit" className="btn btn--primary" disabled={busy || !text.trim()}>
            {busy ? "Working…" : "Apply change"}
          </button>
          {issues.length > 0 && (
            <button type="button" className="btn" disabled={busy} onClick={() => void submit(`Fix these problems and keep everything else the same: ${issues.join(" ")}`)}>
              Fix ball issues
            </button>
          )}
        </div>
      </form>
      <div className="row wrap quick">
        {QUICK_CHANGES.map((q) => (
          <button key={q} type="button" className="chip" disabled={busy} onClick={() => void submit(q)}>
            {q}
          </button>
        ))}
      </div>
      {mode === "demo" && <p className="hint">Demo mode: only slower / faster / mirror / add-a-defender changes are understood.</p>}
      {message && <p className={message.kind === "ok" ? "notice" : "error"}>{message.text}</p>}
    </section>
  );
}

function SavePanel({
  working,
  owned,
  onSaved,
  onCreatePlaybook,
}: {
  working: WorkingCopy;
  owned: OwnedPlaybook[];
  onSaved: (w: WorkingCopy) => void;
  onCreatePlaybook: (name: string) => Promise<OwnedPlaybook>;
}) {
  const [target, setTarget] = useState(working.savedTo?.playbookId ?? owned[0]?.id ?? "__new");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string; link?: string } | null>(null);

  useEffect(() => {
    if (target !== "__new" && !owned.some((o) => o.id === target)) setTarget(owned[0]?.id ?? "__new");
  }, [owned, target]);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      let pbk = owned.find((o) => o.id === target);
      if (!pbk) {
        if (!newName.trim()) throw new ApiError("Name the new playbook first.", 400);
        pbk = await onCreatePlaybook(newName.trim());
        setTarget(pbk.id);
        setNewName("");
      }
      const saved = await api.saveActivity(pbk.id, pbk.editToken, working.activity, working.origin);
      const fresh = await api.getPlaybook(pbk.id, pbk.editToken);
      onSaved({ activity: saved.activity, origin: saved.origin, savedTo: { playbookId: pbk.id, savedId: saved.id } });
      setMessage({ kind: "ok", text: `Saved to “${pbk.name}”.`, link: shareUrl(fresh.shareId, saved.id) });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof ApiError ? err.message : "Save failed." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel save">
      <h3>Save to playbook</h3>
      <div className="row wrap">
        <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Playbook">
          {owned.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
          <option value="__new">+ New playbook…</option>
        </select>
        {target === "__new" && <input value={newName} placeholder="Playbook name" maxLength={120} onChange={(e) => setNewName(e.target.value)} aria-label="New playbook name" />}
        <button type="button" className="btn btn--primary" onClick={() => void save()} disabled={busy}>
          {busy ? "Saving…" : working.savedTo?.playbookId === target ? "Update" : "Save"}
        </button>
      </div>
      {message && (
        <div className={message.kind === "ok" ? "notice" : "error"}>
          {message.text}
          {message.link && <ShareLink url={message.link} />}
        </div>
      )}
    </section>
  );
}

export function ShareLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="share-link">
      <span>View-only link:</span>
      <input readOnly value={url} onFocus={(e) => e.target.select()} aria-label="View-only share link" />
      <button
        type="button"
        className="btn btn--tiny"
        onClick={() => {
          navigator.clipboard?.writeText(url).then(
            () => setCopied(true),
            () => setCopied(false),
          );
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
