# Persistence

Roadmap Management started as a purely in-memory app — every edit lived
only in the Zustand store and vanished on reload. This layer adds real
persistence: the app's domain data now survives reloads (and restarts of
the dev server) by being saved to a JSON file on disk.

## Functional description

### What's persisted

Only the four **domain data** arrays: `projects`, `items`, `resources`,
`deps`. Nothing else — not the active tab, zoom level,
open panels, or any in-progress form. Reload the page and you'll land
back on the Timeline tab at default zoom, but every project, item,
person, and dependency you created or edited will still be there.

> **Note:** parts of this document predate scenarios (planning data now
> lives in `storage/scenarios/*.json`, not `roadmap.json`). The view state
> section below is current.

### View state (`storage/view.json`)

Separate from the planning data, `view.json` keeps how you're looking at
it, global across scenarios:

- `activeScenarioId`, and the date range (`filterStartDay`/`filterEndDay`).
- `filters`: people, roles, statuses, types, "only issues", and the two
  gap toggles (`PersistedFilters`). The dependency-path focus and text
  search are momentary and aren't saved.
- `hiddenProjectIds`: projects hidden in the LeftRail / Projects chip.
  Stored as *hidden* so projects created later show up by default.

`src/lib/persistence/viewFile.ts` sanitizes both on read and write
(`sanitizeFilters`, `sanitizeIds`): unknown fields are dropped, bad values
fall back to "no filter", and an older `view.json` without these fields
loads as all defaults. The client builds the PUT body in one place
(`viewPayload.ts`) and saves it, debounced, whenever the date range,
`filters` or `visible` change.

On boot the view is applied **after** the scenario data loads, so ids that
no longer exist (a deleted person, a removed project) are dropped
(`pruneFilters`). Switching scenarios keeps hidden projects that the new
scenario also has.

### What it feels like

- **On load**: the app briefly shows the built-in seed data (same as
  before this feature), then swaps in whatever was last saved, usually
  fast enough not to be noticeable on localhost.
- **On edit**: nothing visible changes — no "Saving…" indicator, no extra
  clicks. Renaming an item, dragging a bar, adding a resource, deleting a
  project — all of it saves automatically in the background shortly
  after you make the change.
- **Multiple tabs**: not handled. Two browser tabs editing at once will
  race — whichever tab saves last wins, silently overwriting the other's
  changes. Fine for the single-user local use this app is built for;
  would need real conflict resolution (or a proper database) to support
  concurrent editors.

## Technical description

### Files involved

| File | Role |
|---|---|
| `src/lib/persistence/roadmapFile.ts` | Server-only: reads/writes `storage/roadmap.json` |
| `src/app/api/roadmap/route.ts` | Route Handler: `GET` returns the persisted data, `PUT` validates and saves it |
| `src/lib/persistence/useRoadmapPersistence.ts` | Client hook: hydrates the store on mount, debounce-saves on change |
| `src/store/useRoadmapStore.ts` | `hydrate()` action — replaces `projects`/`items`/`resources`/`deps`/`visible` in one `set()` |
| `src/app/page.tsx` | Calls `useRoadmapPersistence()` once, at the top of `Home` |
| `.gitignore` | Excludes `/storage` — persisted data is runtime state, not source |

### Storage format

`storage/roadmap.json` (project root, sibling to `package.json`, **not**
under `src/`) — a single JSON object:

```json
{ "projects": [...], "items": [...], "resources": [...], "deps": [...] }
```

Same shapes as `INITIAL_PROJECTS`/`INITIAL_ITEMS`/`INITIAL_RESOURCES`/
`INITIAL_DEPS` in `initialData.ts` — this is intentionally the same
`RoadmapData` shape the seed data already used, so hydrating from disk is
a drop-in replacement for the seed data rather than a different schema.

### Server side (`roadmapFile.ts`)

- `readRoadmapData()`: reads and `JSON.parse`s the file. If it doesn't
  exist yet (`ENOENT`), builds a `RoadmapData` object from the seed
  constants (`INITIAL_PROJECTS` etc.), writes it out via
  `writeRoadmapData()`, and returns it — so the file is created
  transparently on first run rather than requiring a setup step.
- `writeRoadmapData(data)`: writes atomically — serializes to a
  `roadmap.json.tmp` file first, then `fs.rename()`s it over the real
  file. This avoids ever leaving a truncated/corrupt JSON file on disk if
  the process is killed mid-write (a partial `fs.writeFile` directly to
  the real path could otherwise do that).
- Both use `node:fs/promises`; this module is server-only (imported by
  the route handler alone) since `fs` isn't available in the browser.

### Route Handler (`src/app/api/roadmap/route.ts`)

```ts
GET  → readRoadmapData() → NextResponse.json(data)
PUT  → validate body shape → writeRoadmapData(body) → { ok: true }
```

Validation (`isValidRoadmapData`) only checks that `projects`, `items`,
`resources`, and `deps` are all present and are arrays — it does not
validate the shape of individual `Project`/`Item`/`Resource`/`Dependency`
objects. A malformed inner object (e.g. an item missing `startDay`) would
be written as-is and only surface as a bug when a view tries to render
it. Deliberately lightweight given this is a single-user local tool with
no external clients hitting this endpoint; would need real schema
validation (e.g. `zod`) if this API were ever exposed beyond the app's
own frontend.

Route Handlers are dynamic by default and become non-cacheable
automatically once they touch the filesystem, so no extra
`export const dynamic = ...` config was needed here (see
`node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
— this project pins a Next.js version with its own docs bundled in, per
`AGENTS.md`).

### Client side (`useRoadmapPersistence.ts`)

Two effects, both running once from `page.tsx`:

**Hydration** (mount only):

```ts
fetch('/api/roadmap')
  .then(res => res.ok ? res.json() : null)
  .then(data => data && hydrate(data))
  .finally(() => { hydrated.current = true })
```

`hydrated` is a ref, not state — it exists purely to gate the save effect
below (see next section) and deliberately doesn't trigger a re-render.

**Debounced save** (subscribes for the lifetime of the component):

```ts
useRoadmapStore.subscribe((state, prevState) => {
  if (!hydrated.current) return
  if (state.projects === prevState.projects &&
      state.items === prevState.items &&
      state.resources === prevState.resources &&
      state.deps === prevState.deps) return
  // debounce 600ms, then PUT { projects, items, resources, deps }
})
```

Two things make this cheap and correct rather than chatty:

1. **Reference equality, not deep equality.** Every store action that
   mutates domain data does so immutably (`s.items.map(...)`,
   `[...s.projects, np]`, etc. — see `useRoadmapStore.ts`), so a plain
   `===` check on the four top-level arrays is enough to detect "did
   domain data change" without walking the objects. A `set()` call that
   only touches UI state (`panel`, `draft`, `pxPerDay`, ...) leaves all
   four references untouched, so it's a no-op for persistence — this is
   what keeps keystroke-by-keystroke draft editing and drag's
   per-mousemove `set()` calls from spamming the API.
2. **The `hydrated` gate prevents a self-triggered save.** `hydrate()`
   itself calls `set()`, which the subscriber sees — but at that exact
   moment `hydrated.current` is still `false` (it's flipped in `.finally`,
   *after* the `hydrate()` call in the same promise chain), so the
   initial load-from-disk never immediately re-triggers a save of the
   same data it just loaded.

Debouncing (600ms, restarting the timer on every qualifying change) is
what makes drag-to-reschedule practical: `startDrag`'s `mousemove`
handler calls `set()` on every pixel of movement, but only one `PUT`
fires shortly after the drag settles, not one per mousemove tick.

### Known limitations

- **Filesystem-dependent.** Needs a writable, persistent local
  filesystem. Works for `npm run dev`/`npm run start` locally or on a
  traditional server; would silently stop persisting (or fail) on a
  serverless platform with an ephemeral/read-only filesystem (e.g.
  Vercel's default runtime) — `storage/` would need to move to an actual
  database or object storage there.
- **No unload flush.** The debounce means a change made right before a
  tab close/refresh can be lost if it lands inside the 600ms window with
  no time to fire. Not handled (no `beforeunload` + `sendBeacon`) to keep
  this layer simple — worth adding if that turns out to matter in
  practice.
- **Whole-file writes, no diffing.** Every save rewrites the entire JSON
  file regardless of how small the change was. Fine at this app's data
  scale (a handful of KB); would need incremental writes or a real
  database if the dataset grew large.
