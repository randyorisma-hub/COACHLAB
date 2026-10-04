import { useState } from "react";
import type { Activity } from "../../shared/schema";

type ListKey = "setup" | "instructions" | "rotations" | "coachingCues" | "variations" | "objectives" | "equipment";

const TABS: { key: "overview" | ListKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "setup", label: "Setup" },
  { key: "instructions", label: "Instructions" },
  { key: "rotations", label: "Rotations" },
  { key: "coachingCues", label: "Cues" },
  { key: "variations", label: "Variations" },
];

interface Props {
  activity: Activity;
  readOnly?: boolean;
  onChange?: (next: Activity) => void;
}

export function DetailsPanel({ activity, readOnly, onChange }: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("overview");
  const set = (patch: Partial<Activity>) => onChange?.({ ...activity, ...patch });

  return (
    <section className="panel details">
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? "tab tab--active" : "tab"} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "overview" ? (
        <div className="overview">
          {readOnly ? (
            <p>{activity.summary}</p>
          ) : (
            <label className="field">
              <span>Summary</span>
              <textarea rows={3} value={activity.summary} onChange={(e) => set({ summary: e.target.value })} />
            </label>
          )}
          <dl className="facts">
            <div>
              <dt>Type</dt>
              <dd>{activity.kind}</dd>
            </div>
            <div>
              <dt>Level</dt>
              <dd>{readOnly ? activity.level || "—" : <input value={activity.level} onChange={(e) => set({ level: e.target.value })} aria-label="Level" />}</dd>
            </div>
            <div>
              <dt>Players</dt>
              <dd>{activity.players.length}</dd>
            </div>
            <div>
              <dt>Minutes</dt>
              <dd>
                {readOnly ? (
                  activity.durationMinutes
                ) : (
                  <input type="number" min={1} max={180} value={activity.durationMinutes} onChange={(e) => set({ durationMinutes: Number(e.target.value) || 1 })} aria-label="Minutes" />
                )}
              </dd>
            </div>
            <div>
              <dt>Court</dt>
              <dd>{activity.court === "full" ? "Full court" : "Half court"}</dd>
            </div>
          </dl>
          <ListBlock title="Objectives" items={activity.objectives} readOnly={readOnly} onChange={(objectives) => set({ objectives })} />
          <ListBlock title="Equipment" items={activity.equipment} readOnly={readOnly} onChange={(equipment) => set({ equipment })} />
          <p className="attribution">{activity.attribution}</p>
        </div>
      ) : (
        <ListBlock
          items={activity[tab]}
          ordered={tab === "instructions"}
          readOnly={readOnly}
          onChange={(items) => set({ [tab]: items } as Partial<Activity>)}
        />
      )}
    </section>
  );
}

function ListBlock({
  title,
  items,
  ordered,
  readOnly,
  onChange,
}: {
  title?: string;
  items: string[];
  ordered?: boolean;
  readOnly?: boolean;
  onChange: (items: string[]) => void;
}) {
  if (readOnly) {
    if (items.length === 0) return null;
    const List = ordered ? "ol" : "ul";
    return (
      <div className="list-block">
        {title && <h4>{title}</h4>}
        <List>
          {items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </List>
      </div>
    );
  }
  return (
    <label className="field list-block">
      {title ? <span>{title}</span> : <span className="hint">One item per line</span>}
      <textarea
        rows={Math.max(3, items.length + 1)}
        value={items.join("\n")}
        onChange={(e) => onChange(e.target.value.split("\n"))}
        onBlur={(e) => onChange(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
      />
    </label>
  );
}
