import { useCallback, useEffect, useState } from "react";
import { blankActivity } from "../shared/edit";
import { api, type Mode } from "./api";
import { loadOwned, saveOwned, sessionGet, sessionSet, type OwnedPlaybook } from "./storage";
import { ActivityEditor, type WorkingCopy } from "./components/ActivityEditor";
import { CreateView, initialCreateState, type CreateState } from "./components/CreateView";
import { PlaybooksView, PlaybookView } from "./components/PlaybooksView";
import { ShareView } from "./components/ShareView";
import { DemoBanner } from "./components/Badges";
import { initialLibraryFilters, LibraryDetail, LibraryView, type LibraryFiltersState } from "./components/LibraryView";
import { newId } from "../shared/validate";

type Route =
  | { name: "create" }
  | { name: "edit" }
  | { name: "playbooks" }
  | { name: "playbook"; id: string }
  | { name: "library" }
  | { name: "libraryEntry"; key: string }
  | { name: "share"; shareId: string; savedId?: string };

function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  switch (parts[0]) {
    case "edit":
      return { name: "edit" };
    case "playbooks":
      return { name: "playbooks" };
    case "playbook":
      return parts[1] ? { name: "playbook", id: parts[1] } : { name: "playbooks" };
    case "library":
      return parts[1] ? { name: "libraryEntry", key: parts[1] } : { name: "library" };
    case "share":
      return parts[1] ? { name: "share", shareId: parts[1], savedId: parts[2] } : { name: "create" };
    default:
      return { name: "create" };
  }
}

const go = (hash: string) => {
  location.hash = hash;
};

export function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(location.hash));
  const [mode, setMode] = useState<Mode | null>(null);
  const [owned, setOwned] = useState<OwnedPlaybook[]>(loadOwned);
  const [create, setCreate] = useState<CreateState>(() => sessionGet<CreateState>("dpl.create") ?? initialCreateState);
  const [working, setWorking] = useState<WorkingCopy | null>(() => sessionGet<WorkingCopy>("dpl.working"));
  const [libraryFilters, setLibraryFilters] = useState<LibraryFiltersState>(() => sessionGet<LibraryFiltersState>("dpl.library") ?? initialLibraryFilters);

  useEffect(() => {
    const onHash = () => {
      setRoute(parseRoute(location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    api.health().then((h) => setMode(h.mode), () => setMode(null));
  }, []);

  useEffect(() => sessionSet("dpl.create", create), [create]);
  useEffect(() => sessionSet("dpl.working", working), [working]);
  useEffect(() => sessionSet("dpl.library", libraryFilters), [libraryFilters]);
  useEffect(() => saveOwned(owned), [owned]);

  const createPlaybook = useCallback(async (name: string) => {
    const res = await api.createPlaybook(name, "");
    const entry: OwnedPlaybook = { id: res.playbook.id, name: res.playbook.name, editToken: res.editToken };
    setOwned((o) => [...o, entry]);
    return entry;
  }, []);

  const isShare = route.name === "share";

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href={isShare ? location.hash : "#/"} aria-label="Driven Play Lab home">
          <Logo />
          <span>
            <span>DRIVEN</span> <strong>PLAY LAB</strong>
          </span>
        </a>
        {!isShare && (
          <nav>
            <a href="#/" className={route.name === "create" ? "active" : ""}>
              Create
            </a>
            <a href="#/library" className={route.name.startsWith("library") ? "active" : ""}>
              Library
            </a>
            <a href="#/edit" className={route.name === "edit" ? "active" : ""} aria-disabled={!working}>
              Editor
            </a>
            <a href="#/playbooks" className={route.name.startsWith("playbook") ? "active" : ""}>
              Playbooks
            </a>
          </nav>
        )}
      </header>

      {!isShare && mode === "demo" && <DemoBanner />}

      <main>
        {route.name === "create" && (
          <CreateView
            state={create}
            setState={setCreate}
            onOpen={(env) => {
              setWorking({ activity: env.activity, origin: env.origin });
              go("#/edit");
            }}
            onBlank={() => {
              setWorking({ activity: blankActivity(), origin: "manual" });
              go("#/edit");
            }}
          />
        )}
        {route.name === "edit" &&
          (working ? (
            <ActivityEditor working={working} mode={mode} owned={owned} onChange={setWorking} onCreatePlaybook={createPlaybook} />
          ) : (
            <p className="empty">
              Nothing open yet. <a href="#/">Generate suggestions</a> or open an activity from a playbook.
            </p>
          ))}
        {route.name === "playbooks" && (
          <PlaybooksView owned={owned} onCreate={createPlaybook} onForget={(id) => setOwned((o) => o.filter((x) => x.id !== id))} />
        )}
        {route.name === "playbook" && (
          <PlaybookView
            owned={owned}
            id={route.id}
            onOpen={(s, playbookId) => {
              setWorking({ activity: s.activity, origin: s.origin, savedTo: { playbookId, savedId: s.id } });
              go("#/edit");
            }}
            onDeleted={(id) => {
              setOwned((o) => o.filter((x) => x.id !== id));
              go("#/playbooks");
            }}
          />
        )}
        {route.name === "library" && <LibraryView filters={libraryFilters} setFilters={setLibraryFilters} />}
        {route.name === "libraryEntry" && (
          <LibraryDetail
            entryKey={route.key}
            onOpen={(activity) => {
              // A fresh id, so each copy a coach edits and saves is its own activity.
              setWorking({ activity: { ...activity, id: newId("act") }, origin: "library" });
              go("#/edit");
            }}
          />
        )}
        {route.name === "share" && <ShareView shareId={route.shareId} savedId={route.savedId} />}
      </main>

      <footer className="footer">
        Driven Play Lab · Generated plays are original designs and are not attributed to any NBA, college or USA
        Basketball program.
      </footer>
    </div>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
      <circle cx="16" cy="16" r="14" fill="#0b0b0c" stroke="url(#silver)" strokeWidth="2" />
      <path d="M16 2 V30 M2 16 H30 M6 6 C12 12 12 20 6 26 M26 6 C20 12 20 20 26 26" stroke="url(#silver)" strokeWidth="1.4" fill="none" />
      <defs>
        <linearGradient id="silver" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f4f5f7" />
          <stop offset="0.5" stopColor="#9aa0a8" />
          <stop offset="1" stopColor="#d9dce0" />
        </linearGradient>
      </defs>
    </svg>
  );
}
