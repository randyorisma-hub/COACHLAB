import { useEffect, useState } from "react";
import type { PlaybookPublic } from "../../shared/schema";
import { api, ApiError } from "../api";
import { ActivityViewer } from "./ActivityViewer";
import { OriginBadge } from "./Badges";

/** View-only shared playbook. No edit controls are rendered and the API grants no write access. */
export function ShareView({ shareId, savedId }: { shareId: string; savedId?: string }) {
  const [pb, setPb] = useState<PlaybookPublic | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getShared(shareId).then(setPb, (err) => setError(err instanceof ApiError && err.status === 404 ? "This link is no longer active." : "Could not load this playbook."));
  }, [shareId]);

  if (error) return <p className="error">{error}</p>;
  if (!pb) return <p className="hint">Loading…</p>;

  const current = savedId ? pb.activities.find((a) => a.id === savedId) : undefined;
  return (
    <div className="share">
      <div className="readonly-banner">
        View-only playbook: <strong>{pb.name}</strong>
        {pb.team ? ` · ${pb.team}` : ""}
      </div>
      {current ? (
        <>
          <a className="back" href={`#/share/${shareId}`}>
            ← All activities
          </a>
          <ActivityViewer activity={current.activity} origin={current.origin} />
        </>
      ) : pb.activities.length === 0 ? (
        <p className="empty">This playbook is empty.</p>
      ) : (
        <ul className="activity-list">
          {pb.activities.map((s) => (
            <li key={s.id} className="panel">
              <div className="row space">
                <h3>
                  <a href={`#/share/${shareId}/${s.id}`}>{s.activity.title}</a>
                </h3>
                <OriginBadge origin={s.origin} />
              </div>
              <p>{s.activity.summary}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
