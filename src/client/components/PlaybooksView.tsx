import { useEffect, useState } from "react";
import type { PlaybookOwnerView, SavedActivity } from "../../shared/schema";
import { api, ApiError, shareUrl } from "../api";
import type { OwnedPlaybook } from "../storage";
import { OriginBadge } from "./Badges";
import { ShareLink } from "./ActivityEditor";

export function PlaybooksView({
  owned,
  onCreate,
  onForget,
}: {
  owned: OwnedPlaybook[];
  onCreate: (name: string) => Promise<OwnedPlaybook>;
  onForget: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="playbooks">
      <section className="panel">
        <h2>Your playbooks</h2>
        <p className="hint">Playbooks you create are editable from this device. Share a view-only link with players and staff.</p>
        <form
          className="row wrap"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            try {
              await onCreate(name.trim());
              setName("");
              setError(null);
            } catch (err) {
              setError(err instanceof ApiError ? err.message : "Could not create the playbook.");
            }
          }}
        >
          <input value={name} maxLength={120} placeholder="New playbook name (e.g. 8th Grade Boys)" onChange={(e) => setName(e.target.value)} aria-label="New playbook name" />
          <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
            Create
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </section>
      {owned.length === 0 ? (
        <p className="empty">No playbooks yet. Generate an activity and save it, or create a playbook above.</p>
      ) : (
        <ul className="playbook-list">
          {owned.map((o) => (
            <li key={o.id} className="panel">
              <a href={`#/playbook/${o.id}`}>{o.name}</a>
              <button type="button" className="btn btn--tiny btn--ghost" onClick={() => onForget(o.id)} title="Remove from this device (does not delete it)">
                Forget on this device
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PlaybookView({
  owned,
  id,
  onOpen,
  onDeleted,
}: {
  owned: OwnedPlaybook[];
  id: string;
  onOpen: (saved: SavedActivity, playbookId: string) => void;
  onDeleted: (id: string) => void;
}) {
  const me = owned.find((o) => o.id === id);
  const [pb, setPb] = useState<PlaybookOwnerView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;
    api.getPlaybook(me.id, me.editToken).then(setPb, (err) => setError(err instanceof ApiError ? err.message : "Could not load the playbook."));
  }, [me]);

  if (!me) return <p className="error">This playbook isn't saved on this device. Ask its owner for a view-only link.</p>;
  if (error) return <p className="error">{error}</p>;
  if (!pb) return <p className="hint">Loading…</p>;

  return (
    <div className="playbook">
      <section className="panel">
        <h2>{pb.name}</h2>
        {pb.team && <p className="meta">{pb.team}</p>}
        <ShareLink url={shareUrl(pb.shareId)} />
        <div className="row wrap">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={async () => {
              if (!confirm("Create a new share link? The old link will stop working.")) return;
              setPb(await api.rotateShare(me.id, me.editToken));
            }}
          >
            Reset share link
          </button>
          <button
            type="button"
            className="btn btn--danger"
            onClick={async () => {
              if (!confirm(`Delete “${pb.name}” and all its activities? This can't be undone.`)) return;
              await api.deletePlaybook(me.id, me.editToken);
              onDeleted(me.id);
            }}
          >
            Delete playbook
          </button>
        </div>
      </section>
      {pb.activities.length === 0 ? (
        <p className="empty">No activities yet. Generate one and press Save.</p>
      ) : (
        <ul className="activity-list">
          {pb.activities.map((s) => (
            <li key={s.id} className="panel">
              <div className="row space">
                <h3>{s.activity.title}</h3>
                <OriginBadge origin={s.origin} />
              </div>
              <p>{s.activity.summary}</p>
              <p className="meta">Saved {new Date(s.savedAt).toLocaleString()}</p>
              <div className="row wrap">
                <button type="button" className="btn btn--primary" onClick={() => onOpen(s, pb.id)}>
                  Open in editor
                </button>
                <a className="btn btn--ghost" href={`#/share/${pb.shareId}/${s.id}`}>
                  View-only
                </a>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={async () => {
                    if (!confirm(`Remove “${s.activity.title}” from this playbook?`)) return;
                    await api.removeActivity(me.id, me.editToken, s.id);
                    setPb({ ...pb, activities: pb.activities.filter((x) => x.id !== s.id) });
                  }}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
