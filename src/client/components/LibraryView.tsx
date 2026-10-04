import { useMemo, useState } from "react";
import { buildTimeline, frameAt } from "../../shared/engine";
import { ageLabel, buildEntry, CATEGORIES, CATEGORY_LABELS, courtOf, LIBRARY, searchLibrary, type Category, type LibraryEntry } from "../../shared/library";
import { prepareActivity } from "../../shared/pipeline";
import type { Activity } from "../../shared/schema";
import { ActivityViewer } from "./ActivityViewer";
import { OriginBadge } from "./Badges";
import { Court } from "./Court";

const AGE_OPTIONS = [
  { value: "", label: "Any age" },
  { value: "7", label: "Ages 7–8" },
  { value: "9", label: "Ages 9–10" },
  { value: "11", label: "Ages 11–12" },
  { value: "13", label: "Ages 13–14" },
  { value: "16", label: "High school" },
];

export interface LibraryFiltersState {
  query: string;
  category: Category | "all";
  age: string;
  court: "any" | "half" | "full";
}

export const initialLibraryFilters: LibraryFiltersState = { query: "", category: "all", age: "", court: "any" };

/** Library entries are prepared once (normalized + attributed) for display. */
function prepared(entry: LibraryEntry, players?: number): Activity {
  return prepareActivity(buildEntry(entry, { playerCount: players }), "library").activity;
}

export function LibraryView({
  filters,
  setFilters,
}: {
  filters: LibraryFiltersState;
  setFilters: (f: LibraryFiltersState) => void;
}) {
  const results = useMemo(
    () =>
      searchLibrary({
        query: filters.query,
        category: filters.category,
        age: filters.age ? Number(filters.age) : undefined,
        court: filters.court,
      }),
    [filters],
  );
  const counts = useMemo(() => {
    const c = new Map<Category, number>();
    for (const e of LIBRARY) c.set(e.category, (c.get(e.category) ?? 0) + 1);
    return c;
  }, []);

  return (
    <div className="library">
      <section className="panel library-head">
        <h2>Drill library</h2>
        <p className="hint">
          {LIBRARY.length} original drills and plays, written from common coaching practice. Each one animates, opens in the
          editor and links to public coaching pages for further reading.
        </p>
        <div className="row wrap library-filters">
          <input
            id="library-search"
            type="search"
            className="grow"
            placeholder="Search: closeouts, layups, press break…"
            value={filters.query}
            onChange={(e) => setFilters({ ...filters, query: e.target.value })}
            aria-label="Search the library"
          />
          <select id="library-age" value={filters.age} onChange={(e) => setFilters({ ...filters, age: e.target.value })} aria-label="Age">
            {AGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select id="library-court" value={filters.court} onChange={(e) => setFilters({ ...filters, court: e.target.value as LibraryFiltersState["court"] })} aria-label="Court">
            <option value="any">Any court</option>
            <option value="half">Half court</option>
            <option value="full">Full court</option>
          </select>
        </div>
        <div className="category-chips" role="tablist" aria-label="Categories">
          <button type="button" role="tab" aria-selected={filters.category === "all"} className={`chip ${filters.category === "all" ? "chip--active" : ""}`} onClick={() => setFilters({ ...filters, category: "all" })}>
            All · {LIBRARY.length}
          </button>
          {CATEGORIES.map((c) => (
            <button key={c} type="button" role="tab" aria-selected={filters.category === c} className={`chip ${filters.category === c ? "chip--active" : ""}`} onClick={() => setFilters({ ...filters, category: c })}>
              {CATEGORY_LABELS[c]} · {counts.get(c) ?? 0}
            </button>
          ))}
        </div>
      </section>

      {results.length === 0 ? (
        <p className="empty">No drills match. Try fewer words or a different age.</p>
      ) : (
        <div className="library-grid">
          {results.map(({ entry }) => (
            <LibraryCard key={entry.key} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

function LibraryCard({ entry }: { entry: LibraryEntry }) {
  const activity = useMemo(() => prepared(entry), [entry]);
  const timeline = useMemo(() => buildTimeline(activity), [activity]);
  return (
    <a className="panel library-card" href={`#/library/${entry.key}`}>
      <div className="library-court" aria-hidden="true">
        <Court timeline={timeline} frame={frameAt(timeline, 0)} pathStep={activity.steps.length ? 0 : -1} />
      </div>
      <div className="library-card-body">
        <span className="kind">{CATEGORY_LABELS[entry.category]}</span>
        <h3>{activity.title}</h3>
        <p className="meta">
          {ageLabel(entry)} · {entry.minPlayers}+ players · {courtOf(entry) === "full" ? "full" : "half"} court
        </p>
      </div>
    </a>
  );
}

export function LibraryDetail({ entryKey, onOpen }: { entryKey: string; onOpen: (activity: Activity) => void }) {
  const entry = LIBRARY.find((e) => e.key === entryKey);
  const [players, setPlayers] = useState<number>(entry?.defaultPlayers ?? 10);
  const activity = useMemo(() => (entry ? prepared(entry, Math.max(players, entry.minPlayers)) : null), [entry, players]);
  if (!entry || !activity) {
    return (
      <p className="empty">
        That drill isn't in the library. <a href="#/library">Back to the library</a>
      </p>
    );
  }
  return (
    <div className="library-detail">
      <a className="back" href="#/library">
        ← Library
      </a>
      <ActivityViewer
        activity={activity}
        origin="library"
        aside={
          <section className="panel">
            <div className="row space wrap">
              <span className="kind">
                {CATEGORY_LABELS[entry.category]} · {ageLabel(entry)}
              </span>
              <OriginBadge origin="library" />
            </div>
            <div className="row wrap library-actions">
              <label className="field inline">
                <span>Players</span>
                <input
                  id="library-players"
                  type="number"
                  min={entry.minPlayers}
                  max={30}
                  inputMode="numeric"
                  value={players}
                  onChange={(e) => setPlayers(Math.min(Math.max(Number(e.target.value) || entry.minPlayers, entry.minPlayers), 30))}
                />
              </label>
              <button type="button" className="btn btn--primary" onClick={() => onOpen(activity)}>
                Open in editor
              </button>
            </div>
            {entry.references.length > 0 && (
              <div className="references">
                <h4>Further reading</h4>
                <ul>
                  {entry.references.map((r) => (
                    <li key={r.url}>
                      <a href={r.url} target="_blank" rel="noopener noreferrer">
                        {r.title}
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="hint">Links to public coaching pages on the same topic. This write-up and diagram are our own.</p>
              </div>
            )}
          </section>
        }
      />
    </div>
  );
}
