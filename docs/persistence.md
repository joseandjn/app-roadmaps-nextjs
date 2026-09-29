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
| Planning data: projects, items, resources (including their time off), dependencies, sprints, settings, roles | `storage/scenarios/<id>.json` | Per scenario |
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

### Copying tasks to another scenario

- In the Timeline, a click selects a bar and **Cmd/Ctrl/Shift-click** adds
  more (they get a blue outline), or right-click a lane → "Select project
  tasks" (the ones the filters show). With two or more selected, a floating
  bar shows "N selected · Copy to… · Clear"; a single item has "Copy to…" in
  its right-click menu. Esc or a click on empty canvas clears. The selection isn't saved, isn't part of undo, and is cleared
  when switching scenarios.
- **Copy to…** lists the other scenarios. Picking one shows what the copy
  will do there, computed from that scenario's saved data: new tasks, tasks
  that replace their version there (scenarios duplicated from each other
  share ids, so it's the same task), projects/people/roles that come along
  because the target doesn't have them, and dependencies that can't be kept.
- Each copied task brings its own "Depends on": in the target it replaces
  that task's dependencies (other tasks' dependencies on it stay). A
  dependency on a task the target doesn't have is left out and listed.
  Projects, people and roles the target already has are never overwritten.
- Before writing, the target gets a checkpoint "Before copying from <source>"
  — the copying tab's undo can't reach another scenario, so restoring that
  checkpoint (History) is the way back.
- A tab of this browser showing the target reloads right away; others pick
  it up on focus / the 30 s check, like any save from elsewhere.

### What it feels like

- **On load**: the seed data shows briefly, then the saved scenario and
  view replace it.
- **On edit**: no "Saving…" indicator — every change is saved in the
  background shortly after you make it.
- **Multiple tabs**: a save in one tab shows up in the others of the same
  browser right away ("Updated with changes from another tab"). Saves from
  another browser or machine show up when the tab comes back into view or
  focus, or within 30 s while it's in use. A tab never overwrites a save it
  hasn't seen: if it tries, it loads the latest version instead and says
  its last change wasn't saved.

## Technical description

### Files involved

| File | Role |
|---|---|
| `src/lib/persistence/scenarioFile.ts` | Server-only: scenario index and data files, migration from the old `roadmap.json` |
| `src/lib/persistence/checkpointFile.ts` | Server-only: checkpoint files (list, read, create, delete, restore) |
| `src/lib/persistence/viewFile.ts` | Server-only: `view.json`, with `sanitizeFilters` / `sanitizeIds` / `sanitizeSavedViews` |
| `src/app/api/scenarios/…` | Route Handlers (below) |
| `src/app/api/view/route.ts` | `GET`/`PUT` the view state |
| `src/lib/persistence/useRoadmapPersistence.ts` | Client hook: boot sequence, change detection, view saves |
| `src/lib/persistence/scenarioSync.ts` | Client: loads and saves scenario data with its revision, conflicts, sync across tabs |
| `src/lib/persistence/scenarioActions.ts` | Client helpers for switching, creating, promoting scenarios and checkpoint actions |
| `src/lib/persistence/viewPayload.ts` | Builds the `view.json` PUT body from the store (one place for both callers) |
| `src/lib/scenarioCopy.ts` | Pure: what travels with selected tasks (`buildCopyPayload`), merging it into a scenario (`applyCopy`), payload validation; tests in `scenarioCopy.test.ts` |
| `src/lib/persistence/copyActions.ts` | Client: preview (`GET` target + `applyCopy`) and copy (`POST …/import`), then announces the target's new revision |

### Routes

| Route | Methods |
|---|---|
| `/api/scenarios` | `GET` list + `officialId` · `POST { name, note, basedOn }` duplicates a scenario |
| `/api/scenarios/[id]` | `GET` data (`ETag`; `If-None-Match` → 304) · `PUT` data (requires `If-Match`) · `DELETE` |
| `/api/scenarios/[id]/promote` | `POST` |
| `/api/scenarios/[id]/checkpoints` | `GET` metadata list · `POST { name, note }` |
| `/api/scenarios/[id]/checkpoints/[cid]` | `GET` full checkpoint · `DELETE` |
| `/api/scenarios/[id]/checkpoints/[cid]/restore` | `POST` |
| `/api/scenarios/[id]/import` | `POST { payload, checkpointName }`: checkpoint, then `applyCopy` on the current data, saved against its revision (re-applied up to 3 times if another save lands in between) → `{ summary, rev, checkpointId }` |
| `/api/view` | `GET` · `PUT` |

Validation is shallow: a scenario `PUT` only checks that the top-level
arrays and `settings` exist. `view.json` fields are sanitized rather than
rejected, so an older or partial payload still saves and an old
`view.json` loads with defaults. Route Handlers are dynamic by default and
touching the filesystem keeps them uncached, so no extra config is needed
(see `node_modules/next/dist/docs/`, per `AGENTS.md`).

### Server side

- **Revisions.** A scenario's revision is a hash of its file
  (`revisionOf`), so any write changes it: a save, a checkpoint restore,
  a hand edit. `GET` sends it as the `ETag`. `PUT` must send it back in
  `If-Match`: missing → 428, different from the file → 409 with the
  current `data` and `rev`, so the client can load it. Writes to one
  scenario are queued (`queued`), so two saves can't both pass the check
  before either writes. Checkpoint restore writes without a revision:
  it's an explicit overwrite.
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
  `settings`, `roles`) → `scheduleSave()` in `scenarioSync.ts` →
  `PUT /api/scenarios/<active>` with `If-Match`.
- Date range, `visible`, saved views, or a persisted part of `filters` →
  `PUT /api/view`. The text search and dependency path are ignored, so
  typing a search doesn't rewrite the file.

Both are debounced (600 ms, restarting on each change) — a drag calls
`set()` on every mousemove but only one PUT fires once it settles. Change
detection is reference equality (`state.items !== prevState.items`): store
actions update immutably, and UI-only `set()` calls leave these references
untouched. A `hydrated` ref gates the subscriber until boot finishes, and
`isApplyingScenario()` while any load replaces the data, so loading from
disk never triggers a save of the same data.

**Revisions and other tabs** (`scenarioSync.ts`). Every load
(`loadScenario`) remembers the revision; every save sends it and keeps the
new one. Saves run one after another, so each sends the revision the
previous one got back.

- **Conflict** (409, or 428 when the tab has no revision, e.g. after a hot
  reload): load what's on disk (`hydrateScenario`, which also resets undo
  history so Cmd+Z can't bring back the old version) and toast that the
  last change wasn't saved.
- **Other tabs of this browser**: a successful save (or a conflict load, or
  a checkpoint restore) is announced on the `roadmap-scenario-sync`
  `BroadcastChannel`. A tab that gets it reloads the scenario, unless it
  already has that revision or a save is in flight. If it had an unsaved
  change waiting on the debounce, that change is dropped with the conflict
  toast, since it can't be saved on top.
- **Other browsers or machines**: on `visibilitychange`, window `focus`,
  and every 30 s while the tab is visible or focused, a `GET` with
  `If-None-Match` checks the disk; an unchanged scenario costs a 304.

Switching scenarios (`scenarioActions.switchScenario`) first saves any
pending change, then loads the data with `hydrateScenario` — which keeps
hidden projects the new scenario also has — and saves the view
immediately. `saveCheckpoint` flushes a pending save first so the
checkpoint never misses an edit.

### Known limitations

- **Filesystem-dependent.** Needs a writable, persistent disk; on a
  serverless platform with an ephemeral filesystem `storage/` would need to
  move to a database or object storage.
- **No unload flush.** A change made in the last 600 ms before closing the
  tab can be lost (no `beforeunload` + `sendBeacon`).
- **A conflict drops the losing tab's change.** It's announced, not
  merged. Edits in two places inside the same ~600 ms window are rare;
  the cost is redoing one change.
- **`view.json` is still last-writer-wins.** It's UI state (filters, date
  range, active scenario), so two tabs with different filters take turns
  writing it. No planning data is at stake.
- **Whole-file writes.** Each save rewrites the whole scenario file, and
  every checkpoint stores a full copy. Fine at this data size.
