# Persistence

Everything you plan survives reloads and dev-server restarts: it's saved as
JSON files under `storage/` (project root, git-ignored). Planning data lives
in **scenarios**, each with its own **checkpoint** history; how you're looking
at the plan (active scenario, date range, filters, saved views) lives in a
separate `view.json`.

## Functional description

### What's persisted

| What | Where | Scope |
|---|---|---|
| Planning data: projects, items, resources, dependencies, sprints, settings, roles | `storage/scenarios/<id>.json` | Per scenario |
| Scenario list and which one is official | `storage/scenarios/index.json` | Global |
| Checkpoints (named snapshots + metrics) | `storage/scenarios/<id>.checkpoints.json` | Per scenario |
| Active scenario, date range, filters, hidden projects, saved views | `storage/view.json` | Global |

Not persisted: the active tab, zoom, open panels and forms, the dependency
path focus and the text search.

### Scenarios

- One scenario is **official**: it's what opens when `view.json` has no
  active scenario yet. The voice agent reads the **active** scenario.
- **New scenario** duplicates the active one (same ids, so hidden projects
  and filters carry over) and switches to it.
- **Promote** marks another scenario official without touching any data.
- The official scenario and the last remaining one can't be deleted;
  deleting a scenario also deletes its checkpoints.

### Checkpoints

- **Save checkpoint** stores a full copy of the scenario plus summary
  metrics (`computeScenarioMetrics`: cost, end date…), so History can show
  how the estimate evolved and diff any checkpoint against now.
- **Restore** overwrites the scenario's current data with the snapshot
  (an in-place rollback, not a fork) and reloads it.

### What it feels like

- **On load**: the seed data shows briefly, then the saved scenario and
  view replace it.
- **On edit**: no "Saving…" indicator — every change is saved in the
  background shortly after you make it.
- **Multiple tabs**: not handled; whichever tab saves last wins.

## Technical description

### Files involved

| File | Role |
|---|---|
| `src/lib/persistence/scenarioFile.ts` | Server-only: scenario index and data files, migration from the old `roadmap.json` |
| `src/lib/persistence/checkpointFile.ts` | Server-only: checkpoint files (list, read, create, delete, restore) |
| `src/lib/persistence/viewFile.ts` | Server-only: `view.json`, with `sanitizeFilters` / `sanitizeIds` / `sanitizeSavedViews` |
| `src/app/api/scenarios/…` | Route Handlers (below) |
| `src/app/api/view/route.ts` | `GET`/`PUT` the view state |
| `src/lib/persistence/useRoadmapPersistence.ts` | Client hook: boot sequence and debounced saves |
| `src/lib/persistence/scenarioActions.ts` | Client helpers for switching, creating, promoting scenarios and checkpoint actions |
| `src/lib/persistence/viewPayload.ts` | Builds the `view.json` PUT body from the store (one place for both callers) |

### Routes

| Route | Methods |
|---|---|
| `/api/scenarios` | `GET` list + `officialId` · `POST { name, note, basedOn }` duplicates a scenario |
| `/api/scenarios/[id]` | `GET` data · `PUT` data · `DELETE` |
| `/api/scenarios/[id]/promote` | `POST` |
| `/api/scenarios/[id]/checkpoints` | `GET` metadata list · `POST { name, note }` |
| `/api/scenarios/[id]/checkpoints/[cid]` | `GET` full checkpoint · `DELETE` |
| `/api/scenarios/[id]/checkpoints/[cid]/restore` | `POST` |
| `/api/view` | `GET` · `PUT` |

Validation is shallow: a scenario `PUT` only checks that the top-level
arrays and `settings` exist. `view.json` fields are sanitized rather than
rejected, so an older or partial payload still saves and an old
`view.json` loads with defaults. Route Handlers are dynamic by default and
touching the filesystem keeps them uncached, so no extra config is needed
(see `node_modules/next/dist/docs/`, per `AGENTS.md`).

### Server side

- **Atomic writes.** Every file is written to `<file>.tmp` and then
  `fs.rename`d over the real one, so a crash mid-write never leaves
  truncated JSON.
- **Migration.** The first time scenario storage is touched and
  `index.json` doesn't exist, `ensureMigrated()` wraps the old
  `storage/roadmap.json` (or the seed data on a fresh install) into a
  scenario `s-original` named "Roadmap actual", marks it official, and
  renames the old file to `roadmap.json.bak`.
- **`ensureRoles`** backfills the roles catalog on every read and write, so
  data from before roles existed (including old checkpoints) self-heals.
- `readViewState()` falls back to the official scenario when `view.json`
  is missing or has no `activeScenarioId`.

### Client side (`useRoadmapPersistence.ts`)

**Boot**, once from `page.tsx`: `GET /api/view` → set the active scenario →
`GET /api/scenarios` (list) → `GET /api/scenarios/<active>` →
`hydrateScenario(data)` → `hydrateView(view)`. The view goes last so ids in
filters and hidden projects that don't exist in the data are dropped
(`pruneFilters`). If anything fails, the seed data stays.

**Saves** come from one `useRoadmapStore.subscribe`:

- Planning data (`projects`, `items`, `resources`, `deps`, `sprints`,
  `settings`, `roles`) → `PUT /api/scenarios/<active>`.
- Date range, `visible`, saved views, or a persisted part of `filters` →
  `PUT /api/view`. The text search and dependency path are ignored, so
  typing a search doesn't rewrite the file.

Both are debounced (600 ms, restarting on each change) — a drag calls
`set()` on every mousemove but only one PUT fires once it settles. Change
detection is reference equality (`state.items !== prevState.items`): store
actions update immutably, and UI-only `set()` calls leave these references
untouched. A `hydrated` ref gates the subscriber until boot finishes, so
loading from disk never triggers a save of the same data.

Switching scenarios (`scenarioActions.switchScenario`) loads the data with
`hydrateScenario` — which keeps hidden projects the new scenario also has —
and saves the view immediately. `saveCheckpoint` first flushes the current
data with a PUT so the checkpoint never misses a pending edit.

### Known limitations

- **Filesystem-dependent.** Needs a writable, persistent disk; on a
  serverless platform with an ephemeral filesystem `storage/` would need to
  move to a database or object storage.
- **No unload flush.** A change made in the last 600 ms before closing the
  tab can be lost (no `beforeunload` + `sendBeacon`).
- **Whole-file writes.** Each save rewrites the whole scenario file, and
  every checkpoint stores a full copy. Fine at this data size.
