# Shared Components

Unlike `TimelineView` / `CrossView` / `ResourcesView` — one component per
tab — `FilterBar`, `LeftRail`, and `ProjectModal` are each mounted **once**,
alongside whichever view is active, and stay reachable from all three. This
doc covers all three, functionally and technically, as the reusable pieces
of the shell.

## FilterBar

`src/components/FilterBar.tsx` — the thin bar directly under the Toolbar.
Left to right: the **Views** menu, the date range, the text search, the
filter chips (Projects, Status, Type, People, Roles, Gaps, Only issues), the
dependency-path and Analysis-finding chips when active, **Reset** and the
**filtered · N** pill. Below 1600px wide (270px more per path/finding chip)
the chips collapse into one **Filters · N** button (`FiltersGroup`), and the
"Date range" label hides below 1440px.

Everything except the date range — what each filter matches, hide vs. dim,
which metrics respect filters, saved views and persistence — is documented
in [`docs/filters.md`](filters.md). The rest of this section covers the date
range.

### Functional description

- Two native `<input type="date">` fields ("start" and "end"). "Reset"
  and the "filtered" pill appear once any filter is active; Reset clears
  the dates along with every other filter.
- Changing either date narrows what all three views render: bars/lanes
  outside the range are hidden and each view's horizontal scroll extent
  shrinks to match.
- Picking a start date after the current end (or vice versa) doesn't
  produce an invalid range — the other bound is pushed to stay at least
  one day away, so the range never inverts or collapses to zero width.
- "Reset" clears both bounds, returning every view to the full project
  timeline.

### Technical description

- All state lives in the store: `filterStartDay` / `filterEndDay`
  (`number | null` day offsets from `START_DATE`), read and written via
  `setFilter(start, end)` / `clearFilter()`. `FilterBar` itself holds no
  local state.
- `null` means "unbounded on that side" — `FilterBar` displays it as day
  `0` / the plan end (`dateStr(filterStartDay ?? 0)` /
  `dateStr(planEnd)`, from `usePlanEnd()`), but the underlying value stays
  `null` until the user actually edits that field, so "no filter" is a
  real distinct state from "filter spanning the whole range."
- Date `<input>` values are ISO strings (`YYYY-MM-DD`); `offFromStr()` /
  `dateStr()` (`roadmapUtils.ts`) convert between that and the integer
  day-offset representation every view's rendering math uses.
- `handleStart`/`handleEnd` clamp against each other
  (`Math.min(day, end - 1)` / `Math.max(day, start + 1)`) — this is the
  only validation; there's no upper bound, so a user can pick dates
  further out than any item data (the views just render more empty space).
- **Plan end**: with no end date, the views end at `planEnd()`
  (`roadmapUtils.ts`): the last item end, sprint end, today or
  `filterStartDay`, whichever is latest, plus `PLAN_BUFFER_DAYS` (180). It
  grows with the plan, so there's no fixed last year. `usePlanEnd()`
  (`src/lib/usePlanEnd.ts`) returns `filterEndDay ?? planEnd(...)` and is
  what every view reads.
- **Consumers**: `TimelineView`, `CrossView`, and `ResourcesView` all read
  `filterStartDay`/`filterEndDay` independently to compute their own
  `baseDay`/`lastDay`/`totalWidth`, and each has its own `useEffect` that
  resets its scroll position to the left edge whenever these two values
  change. `FilterBar` itself has no awareness of which view is currently
  active — it's a pure store-state editor.

## LeftRail

`src/components/LeftRail.tsx` — the collapsible sidebar. It's one
component with two entirely different render modes, switched on
`view === 'resources'`.

### Functional description

**Project mode** (Timeline / Cross-Project tabs):

- Lists every project with a color-coded visibility checkbox, name,
  owner, and item count, dimmed when hidden.
- Toggling a project's checkbox shows/hides its lane in whichever Gantt
  view is active — this is the same `visible` Set both `TimelineView` and
  `CrossView` filter on.
- Clicking a project's name/description opens `ProjectModal` to edit it;
  clicking the "+" on a row opens the item-creation panel for that
  project (`newItem`).
- A status-color legend (In Progress / At Risk / Planned / Done) sits at
  the bottom.

**Resource mode** (Resources tab):

- Lists every person with their avatar initials, name, role, and **peak
  allocation %** across the whole timeline (via `resPeak()` — see
  [`docs/resources-view.md`](resources-view.md) for why this can differ
  from any single grid cell's %), colored the same way allocation is
  colored everywhere else (`allocColor()`).
- Clicking a person opens their summary panel in `RightPanel`
  (`openRes`) — the currently-selected person is highlighted.
- A small Available/Full legend, a calendar button that opens
  `ImportTimeOffModal` (bulk time off from a spreadsheet, see
  [`docs/time-off.md`](time-off.md)) and a "+ Add" button (opens
  `ResourceModal`) replace the status legend from project mode.

**Both modes**: the whole sidebar collapses to a thin 28px vertical strip
via the `❮`/`❯` toggle button, controlled by the store's `railOpen` flag
— useful for reclaiming horizontal space on any of the three views.

### Technical description

- Single `railOpen` boolean in the store, toggled via `toggleRail()`;
  when `false`, `LeftRail` short-circuits to a 28px-wide button and skips
  rendering either list.
- Mode switch is a plain conditional on `view === 'resources'` — there's
  no separate component per mode; both branches live in the same file and
  share the header row (title + count + collapse button), just with
  different labels (`"Resources" / "{n} people"` vs. `"Projects" /
  "{visible}/{total}"`).
- **Project mode** reads `projects`, `items` (for the owner lookup + item
  count), and `visible`; writes via `toggleProject`, `editProject`,
  `newItem`.
- **Resource mode** reads `resources` and `items`, recomputing
  `resPeak(resource.id, items)` for every row on every render (same
  non-memoized pattern as the rest of the app — fine at the current seed
  scale). Writes via `openRes`, `onNewResource`.
- `resSel` + `panel` together determine the "selected" row highlight in
  resource mode (`resSel === r.id && panel === 'res'`) — so the highlight
  correctly clears if the user opens an item or cell panel instead of a
  resource panel, even though `resSel` itself might still hold the last id.
- No props: like every other component in this app, `LeftRail` pulls
  everything it needs straight from `useRoadmapStore()` rather than
  receiving it from a parent — `page.tsx` renders `<LeftRail />` with no
  arguments.

## ProjectModal

`src/components/modals/ProjectModal.tsx` — the centered dialog for
creating and editing a project. Reachable from every view: the Toolbar's
"+ New project" button, `LeftRail`'s click-a-project-to-edit (project
mode), and the voice agent's `create_project`/`update_project`/
`show_project`/`delete_project` tools (`docs/voice-agent.md`) all end up
here — voice's create/update tools bypass it entirely via direct store
actions (`agentCreateProject`/`agentUpdateProject`), but show/delete
specifically *open* this same modal, reusing it as the read-detail view
and the delete-confirmation gate respectively.

### Functional description

- **Fields**: Name, Description, Owner (select, from `resources`),
  Category (select, `CATEGORIES`), Status (select, `STATUS_ORDER`), and a
  Start/End date pair.
- **Creating** (`+ New project`): Start/End default to today through
  +90 days. Below them, an **"Add default tasks"** checkbox — checked by
  default — only appears here, never when editing.
- **Editing** (click a project): Start/End instead show the *computed*
  range of the project's existing items (earliest start to latest end),
  falling back to the same today/+90 default if it has none yet. A
  "Delete" button appears in the footer.
- **Add default tasks**: when checked at creation time, four sequential
  tasks — Desarrollo, Certificación, Gestión de pase, Pase a PRD — are
  created alongside the project, spread evenly across the Start–End range
  entered above. This is also what gives the Start/End fields real effect
  on creation for the first time — see Technical description below.

### Technical description

- All state lives in the store's `pform` (`show`, `id: string | null` —
  `null` means "creating," a real id means "editing" — `name`, `desc`,
  `owner`, `category`, `status`, `startStr`, `endStr`, `canDelete?`,
  `defaultTasks?`), read/written via `patchPF(partial)`. The modal itself
  holds no local state, same pattern as `ResourceModal`
  (`docs/resources-view.md`).
- `onNewProject()` seeds `pform` with `defaultTasks: true` — opt-out, not
  opt-in, since it's meant to be the common case for this app's workflow
  rather than a rarely-used extra. `editProject(id)` never sets
  `defaultTasks` at all, which is what the `!pform.id` check in the
  component uses to hide the checkbox entirely on edit (there's no
  "add default tasks to an existing project" concept — cleaner to hide
  the control than to make it a no-op).
- **`onPSave()`'s create branch** (`pform.id === null`) is where the
  default-tasks logic lives:
  ```ts
  const start = offFromStr(f.startStr)
  const end = Math.max(start + DEFAULT_PROJECT_TASKS.length, offFromStr(f.endStr))
  const share = Math.floor((end - start) / DEFAULT_PROJECT_TASKS.length)
  // ...map DEFAULT_PROJECT_TASKS to sequential Items, each `share` days
  // long except the last, which absorbs the remainder up to `end`
  ```
  `DEFAULT_PROJECT_TASKS` (`initialData.ts`) is the 4-title list. The
  `Math.max(start + length, ...)` guards against a very short or inverted
  Start/End pair collapsing segments below 1 day each; every segment is
  additionally clamped to `Math.max(1, ...)` when built. New items are
  appended to `items` in the **same** `set()` call that adds the project,
  so the project and its default tasks always land in the store together,
  never as two renders where one briefly exists without the other.
  Unchecked, this whole block is skipped — `onPSave` behaves exactly as it
  did before this feature existed.
- **`onPSave()`'s edit branch** (`pform.id` set) is untouched by any of
  this — it only ever patches the four editable project fields, never
  touches `items`, matching the "Delete = HITL" idea from `docs/
  voice-agent.md`: editing a project's fields and adding tasks to it are
  different operations, not bundled into one save.
- `startStr`/`endStr` were already being computed correctly for *edit*
  mode before this feature (via `projRange()` over the project's items) —
  they were simply *inert* on create, captured into `pform` but never
  read by `onPSave`. Default tasks is what makes those two inputs
  actually do something the first time a project is saved.

## Why these three are "shared" rather than view-owned

All three are mounted exactly once in `page.tsx`, outside the
`view === ...` conditional that swaps between `TimelineView`/`CrossView`/
`ResourcesView` (see `ARCHITECTURE.md`'s "Directory layout"). None of them
own a tab; each conditions its own content on store state
(`view`/`filterStartDay`/`filterEndDay` for the first two, `pform.show`
for the third) and lets the active view read the same state back. That
makes them the places in the codebase where "shared across views" is a
structural fact, not just a description — worth keeping in mind if any of
them is ever refactored, since a change to their store contract
(`filterStartDay`/`filterEndDay`, `visible`, `railOpen`, `pform`, etc.)
affects all three views at once, not just one.
