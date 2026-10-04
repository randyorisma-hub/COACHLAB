# Driven Play Lab

A mobile-friendly basketball coaching platform. A coach describes a drill, play or team need, for example *"We have 12 eighth graders who need to improve passing and cutting."* Driven Play Lab then returns **three suggestions**. Each one comes with setup, instructions, rotations, coaching cues, variations and an **animated, editable court diagram**.

- **Playback:** play, pause, 0.25×–2× speed, step forward and back, scrub, loop.
- **Editing:** drag players to set starting spots. Drag a player during a step to create a cut, or a dribble for the ball handler. Drag the ◆ handle to change where a path ends, or curve the path. You can also edit action type, player, receiver, start time and duration, and add, reorder or delete steps and players. Undo and redo are available.
- **Plain-language changes:** for example "Add a passive defender" or "Have 4 screen for 2". The request goes to Claude through the server.
- **Playbooks:** save activities into team playbooks and share **view-only** links.
- Every player has a unique on-court label. Passes, dribbles, cuts, screens, moves and shots each have a distinct line style (see the legend under the court).

## Quick start

Requires Node.js 20.12+ (22 recommended).

```bash
npm install
cp .env.example .env        # optional: add ANTHROPIC_API_KEY for real AI
npm run dev                 # API on :8787, app on http://localhost:5173
```

Open http://localhost:5173 on your laptop or phone (same network: `npx vite --host`).

Production build (one process serves the API and the built app):

```bash
npm run build
npm start                   # http://localhost:8787
```

### Configuration (`.env`, server only)

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Enables real AI. Without it the app runs in **demo mode**. |
| `ANTHROPIC_MODEL` | `claude-opus-5-5` | Claude model used for generation and revisions. |
| `AI_EFFORT` | `medium` | `low` / `medium` / `high` / `xhigh` / `max`: trades thoroughness against latency and cost. |
| `AI_FALLBACKS` | `on` | Server-side refusal fallback (Claude API). Set `off` if you point the SDK at a platform that doesn't support it. |
| `AI_REQUESTS_PER_MINUTE` | `10` | Per-IP limit on `/api/generate` and `/api/revise`. |
| `DEMO_MODE` | — | `1` forces demo mode even when a key is set. |
| `PORT` | `8787` | API/server port. |
| `DATA_FILE` | `data/playbooks.json` | Where playbooks are stored. |

### Credentials

- The Anthropic key is read only by the Node server (`src/server/generators.ts`). The browser talks to `/api/*` and never sees the key.
- `.env` and `data/` are git-ignored.
- `tests/security.test.ts` fails if browser code (`src/client`, `src/shared`) imports the SDK or reads `process.env`/`ANTHROPIC_*`.

### Demo mode

When no key is configured, the server answers `/api/generate` from a small hand-written library of 7 activities (`src/server/demoLibrary.ts`). The library picks the best keyword matches and sizes the lines to the team. Demo mode is clearly labeled:

- A banner appears on every page.
- Each demo activity carries a **DEMO sample** badge, which is also stored with saved activities.
- `/api/health` reports `mode: "demo"`.

Demo revisions understand only *slower, faster, mirror/flip, add a defender*. Everything else works the same in both modes: editing, playback, playbooks and sharing.

## How it works

```
src/
  shared/            pure TypeScript, used by server, browser and tests
    schema.ts        Zod schemas: Activity, Player, Step, Action (+ court coordinate system)
    engine.ts        deterministic animation engine: buildTimeline() + frameAt(t)
    validate.ts      normalizeActivity() (safe fixes) + findIssues() (ball-possession logic)
    attribution.ts   guardrail against unverified NBA/college/USA Basketball attribution
    edit.ts          immutable editor operations
    pipeline.ts      normalize → guardrail → issues, for every activity
  server/
    app.ts           Express routes, security headers, error mapping
    generators.ts    AiGenerator (Claude via @anthropic-ai/sdk) and DemoGenerator
    prompts.ts       system prompt (coordinate conventions, action semantics, attribution rule)
    store.ts         playbook storage (atomic JSON file, hashed edit tokens, share ids)
  client/            React + Vite UI (Court SVG renderer, playback, editor, playbooks, share view)
tests/               Vitest: engine consistency, validation, editing, saving, API, security
```

### Structured data drives the animation

An activity is data, not a video:

- **Players:** `{ id, label, role, x, y }` in feet. `x` runs 0–50 from sideline to sideline. `y` runs from 0 at the baseline under the hoop to 47 at half court, or 94 for a full court.
- **Steps:** sequential phases with a duration in seconds.
- **Actions** inside each step: `cut | dribble | pass | screen | move | shot`, with `delay` and `duration` in seconds, an optional `to` and `via` (curve control point), and an optional `targetId` (receiver, rebounder or screened player).

`buildTimeline()` computes each step's starting state from the previous step's end. `frameAt(t)` returns every player's position and the ball's position, holder and in-flight flag at any time. Playback, scrubbing, stepping, suggestion previews and share views all call the same pure function, so they always agree.

### AI

`AiGenerator` calls `client.beta.messages.stream()` with:

- Claude Opus 5.5 by default
- adaptive thinking
- **structured outputs** (`betaZodOutputFormat`), so the response must match the Activity schema
- server-side refusal fallbacks

Refusals, truncation and unparseable output become friendly errors; provider error details are never forwarded to the browser. Every result then goes through `prepareActivity()`, which clamps coordinates to the court, de-duplicates IDs, drops actions that reference missing players, serializes overlapping moves and passes, applies the attribution guardrail and reports ball-possession issues. When an activity has possession issues, the editor shows them and offers a **Fix ball issues** button, which sends them back to Claude as a revision.

### Attribution policy

Generated plays are original designs. The system prompt forbids naming pro, college, Olympic or USA Basketball teams, programs or coaches. After the model responds, `enforceAttribution()` removes any sentence that does so anyway and sets the attribution to *"Original design generated by Driven Play Lab. Not attributed to, or endorsed by, any NBA, WNBA, college or USA Basketball program."* Generic concept names such as Horns or 5-out motion are allowed. Activities a coach builds by hand keep the coach's own wording.

### Playbooks and sharing

There are no user accounts yet:

- Creating a playbook returns a secret **edit token**. The browser keeps it in `localStorage`; the server stores only its SHA-256 hash. Every write requires the token.
- Each playbook also has a random **share id**. `#/share/<shareId>` (optionally `/<activityId>`) is a read-only view. The share API strips the token hash and the share id, and grants no write access.
- **Reset share link** revokes the old link.
- Storage is a JSON file with atomic writes and serialized mutations. `PlaybookStore` is the only persistence boundary; replace it with a database-backed class of the same shape for multi-instance deployments.

## Tests

```bash
npm test          # vitest run
npm run typecheck # tsc --noEmit
```

- **Animation consistency** (`tests/engine.test.ts`), for every demo activity, sampled every 10 ms:
  - every player is present and identifiable (unique ids and labels) in every frame
  - no player or the ball ever teleports
  - positions are continuous at every step boundary and match the precomputed step states
  - everything stays on the court
  - results are deterministic
  - ball possession is consistent

  Unit tests also cover delays, destinations, pass flight and possession transfer, shots and rebounds, Bézier curves, time clamping and step stretching.
- **Saving** (`tests/store.test.ts`, `tests/api.test.ts`):
  - an activity saved and reloaded from disk by a fresh store is identical and animates frame-for-frame the same
  - re-saving updates in place
  - edit tokens are required and never stored in plain text
  - share links are view-only and revocable
  - concurrent saves are not lost
  - activities are normalized before storage
- **Editing** (`tests/edit.test.ts`), **validation and attribution** (`tests/validate.test.ts`), **schemas sent to Claude** (`tests/schema.test.ts`).
- **AI integration** (`tests/api.test.ts`) uses a fake SDK transport to check the request (model, adaptive thinking, structured output, fallbacks, the coach's prompt), the guardrail, fresh ids, refusal (422) and parse-failure (502) handling, plus rate limiting and security headers.

## Roadmap

- **Phase 1 (this release):** text → three drills or plays, animated and editable, with plain-language revisions, playbooks and share links.
- **Phase 2:** import screenshots, whiteboard photos and PDF playbook pages. The UI tab is present and marked *Phase 2*; Claude's vision and PDF input would produce the same Activity schema.
- **Phase 3:** reconstruct movement from game footage into the same Activity schema. The UI tab is present and marked *Phase 3*.
- Later: accounts and team roles, a database store, exporting diagrams (PNG/PDF), and source-verified attribution for plays with a documented origin.
