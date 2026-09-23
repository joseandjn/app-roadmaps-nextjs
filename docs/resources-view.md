# Resources View

The "Resources" tab answers one question: **who is allocated to what, and
when.** It's a live cross-tab of people × time, derived entirely from item
assignments — there is no separate "allocation" record anywhere in the data
model.

## Functional description

### What you see

- The left sidebar lists every person (`LeftRail.tsx`, resources branch):
  avatar initials, name, role, and their **peak allocation %** across the
  entire timeline (not just the visible date range). A small legend at the
  bottom explains the color coding (Available / Full).
- The main panel (`ResourcesView.tsx`) is a grid: one row per person, one
  column per time bucket (day/week/month/quarter, depending on zoom). Each
  cell shows:
  - the person's total allocation % for that bucket, colored by how loaded
    they are
  - a thin multi-segment bar underneath, showing which project(s) that
    time is split across, in each project's color
- A red vertical line marks "today." Zooming in/out (Toolbar) changes
  bucket size; the active date-range filter (FilterBar) narrows the visible
  columns.

### How you interact with it

- **Click a person in the sidebar** → opens a right-side panel with their
  overall summary: peak allocation %, a status tag (*Free / Available /
  Full / Overallocated*), a progress bar, and every item they're assigned
  to, grouped by project, each with its % and start date.
- **Click a cell in the grid** → opens a right-side panel scoped to just
  that person + that time bucket: the total % for that bucket, its status
  tag, and the list of items contributing to it (title, project, %). If
  nothing is assigned in that period, it says so.
- **Add a person** via the "+ Add" button in the sidebar footer, which
  opens `ResourceModal` with empty Name / Role / Cost fields.
- **Edit or remove a person** via the **Edit** button in their summary
  panel header (click a person in the sidebar first, then Edit) — opens
  the same `ResourceModal`, pre-filled, with a **Remove** button.
  Removing someone strips them from every item's `assignments` too, so
  their allocation disappears everywhere at once rather than leaving
  orphaned references. There's currently no edit entry point from the
  grid cell panel or from the sidebar row directly — only from the
  person's summary panel.

### Adding / editing a resource

`ResourceModal` (`src/components/modals/ResourceModal.tsx`) is a small
centered dialog with three fields:

| Field | Type | Notes |
|---|---|---|
| Name | text | Falls back to "New person" on create if left blank |
| Role | select | One of `ROLES` (`initialData.ts`) |
| Cost ($/mo) | number | Monthly cost, clamped to ≥ 0; defaults to `0` on create |

Saving calls `onRSave()`, which either patches the existing `Resource` in
place (edit) or appends a new one with a generated id (`'r' + Date.now()`)
(add) — either way followed by a "Resource updated" / "Resource added"
toast. Cost is not shown anywhere else in the UI yet (not the grid, not
the sidebar, not the summary panel) — it's currently modal-only, tracked
purely as data on `Resource` for future use (e.g. a cost rollup per
project or per allocation).

### What counts as "allocation"

Every `Item` has an `assignments: { r: resourceId, pct: number }[]` array.
An item contributes its `pct` to a resource's total for every time bucket
it overlaps, for as long as the item's duration spans it. Milestones and
releases (`dur === 0`) never contribute — they're instants, not spans of
work.

Status tags and colors follow the same thresholds everywhere allocation is
shown (sidebar peak, resource panel, cell panel, grid cells):

| Range | Tag | Color |
|---|---|---|
| ≤ 0% | Free | neutral |
| 1–49% | Available | light blue |
| 50–84% | Available | blue |
| 85–100% | Full | strong blue |
| > 100% | Overallocated | amber |

## Technical description

### Files involved

| File | Role |
|---|---|
| `src/components/views/ResourcesView.tsx` | Renders the grid itself |
| `src/components/LeftRail.tsx` | Renders the person list (resources branch) and peak-% badges |
| `src/components/RightPanel.tsx` | Renders both drill-down panels: `panel === 'res'` (person summary, with the Edit entry point) and `panel === 'cell'` (cell detail) |
| `src/components/modals/ResourceModal.tsx` | Add/edit form (Name, Role, Cost) |
| `src/lib/roadmapUtils.ts` | `buckets`, `buildHeader`, `allocColor`, `resPeak` — all the shared math |
| `src/store/useRoadmapStore.ts` | `openRes`, `openCell`, `onNewResource`, `editResource`, `onRSave`, `panel`/`resSel`/`cell`/`rform` state |
| `src/types/index.ts` | `Resource` (`id`, `name`, `role`, `cost`), `Item`, `Assignment` shapes |

### State

Three pieces of store state coordinate the sidebar and the panel:

- `panel: 'item' | 'cell' | 'res' | null` — which drawer content to render
- `resSel: string | null` — selected resource id, for `panel === 'res'`
- `cell: { rid, bIdx, bucket } | null` — selected resource + bucket, for
  `panel === 'cell'`

Two actions set these:

```ts
openRes:  rid => set({ resSel: rid, panel: 'res',  cell: null, draft: null })
openCell: (rid, bIdx, bucket) => set({ cell: { rid, bIdx, bucket }, panel: 'cell' })
```

Both are read by `RightPanel`, which is mounted once (in `page.tsx`) and
switches its rendered content on `panel`.

### Grid rendering (`ResourcesView.tsx`)

- Layout is a 2×2 CSS grid with sticky positioning: top-left corner label,
  top-right time header (sticky top), bottom-left person-name column
  (sticky left, `LABEL_W = 264px`), bottom-right the scrollable canvas.
  Row height is fixed (`RH = 46px`).
- The visible date range is `[baseDay, lastDay)`, clamped by the store's
  `filterStartDay`/`filterEndDay` (falls back to the full timeline). Zoom
  level (`pxPerDay`) is mapped to a discrete scale index via
  `deriveScale()`, which in turn picks whether `buckets()` returns daily,
  weekly, monthly, or quarterly columns.
- Header bands/gridlines/ticks come from `buildHeader()` — the same
  function `TimelineView`/`CrossView` use for their date headers, so all
  three views stay visually consistent at a given zoom level.
- **Per-cell calculation** (the core loop, `ResourcesView.tsx:65-103`):
  for each `(resource, bucket)` pair, iterate every `Item`; skip items with
  `dur <= 0` or that don't overlap `[bucket.s, bucket.s + bucket.d)`; for
  matching `assignments` where `as.r === resource.id`, accumulate into
  `total` (the %) and into `pAgg[projectId]` (the per-project split used
  for the colored segments, rendered via `flexGrow: pAgg[pid]`).
- This is `O(resources × buckets × items × assignments)` — recomputed on
  every render, no memoization. Fine at the current seed-data scale (5
  projects, a few dozen items); would need `useMemo` or a precomputed
  index if the dataset grows significantly.
- Scroll position is reported to the store (`setViewport`) on every
  `onScroll`, so other parts of the app can read `viewport.left/width`
  (e.g. to keep a minimap or header in sync). On mount, the view
  auto-scrolls to bring "today" roughly into the left third of the
  viewport; when the date-range filter changes, it resets scroll to 0.

### Sidebar peak allocation (`LeftRail.tsx`)

Uses `resPeak(resourceId, items)` — a different aggregation from the grid.
It buckets by **fixed calendar week** (`Math.floor(startDay / 7)`) across
the *entire* timeline (not the filtered range) and returns the single
highest weekly total. This is why the sidebar % can differ from what a
given visible cell shows: the sidebar is "worst week ever," the grid cell
is "this specific bucket, at whatever zoom you're currently at."

### Drill-down panels (`RightPanel.tsx`)

- **`panel === 'res'`** (person summary): computes `resPeak()` for the
  selected person, groups all their assignments by project (`byProj`),
  and renders a progress bar plus a nested list of items per project with
  each item's % and start date. The header also has an **Edit** button
  calling `editResource(resSel)`, which opens `ResourceModal` pre-filled
  with that person's current name/role/cost, layered on top (the summary
  panel stays open behind it).
- **`panel === 'cell'`** (cell detail): re-runs the same overlap-and-sum
  logic as the grid, but scoped to the one `(rid, bucket)` pair passed in
  via `cell`, producing a flat list of contributing items (title, project,
  %, color) for that bucket only.

Both panels independently recompute their numbers from `items` rather than
reading anything cached from the grid — consistent with the rest of the
store: derived values are never stored, only recomputed from `items` /
`assignments` wherever they're needed.

### Add / edit flow (store)

```ts
onNewResource: () => set({ rform: { show: true, id: null, name: '', role: 'Engineering', cost: 0 } })
editResource:  id => set({ rform: { show: true, id, name: r.name, role: r.role, cost: r.cost, canDelete: true } })
onRSave:       () => { /* patches resources[] if rform.id, else appends a new Resource */ }
onRDelete:     () => { /* filters resources[], strips this resource from every item's assignments, closes the panel if it was showing this person */ }
```

`rform` is the single piece of state `ResourceModal` reads/writes
(`show`, `id`, `name`, `role`, `cost`, `canDelete`). `onNewResource` is
wired to the sidebar's "+ Add" button; `editResource` (which also sets
`canDelete: true`, unlocking `ResourceModal`'s "Remove" button) is wired
to the summary panel's Edit button.

### Filters (hidden projects and, later, other filters)

The grid cells, the sidebar peak, and both drill-down panels count only the
items that `itemsForMetrics()` (`src/lib/filters.ts`) keeps — so hiding a
project (LeftRail checkbox or the FilterBar **Projects** chip) removes its
load and its colored segment everywhere in this view.

A filter must never hide a real overload, so each place also computes the
**full** load (every item) next to the filtered one:

- The number shown is the filtered load.
- The color comes from `colorLoad(filtered, full, r)`: the filtered load,
  unless the full load is over the person's capacity, in which case it's
  colored (amber) by the full load.
- Grid cells with load outside the filters get a **dashed** border and a
  tooltip "Total load X% (Y% outside the filters)"; the cell panel shows
  the same line, and the person panel shows "Total peak X% …".

With a **People** filter, the grid shows only those people's rows (the
LeftRail still lists everyone, with a funnel button per person to add or
remove them from the filter).

The cell panel maps the bucket back to absolute days with the same
`baseDay` (`filterStartDay`) offset the grid uses, so its items match the
clicked cell when a date range is set.

### Coloring

`allocColor(pct)` (in `roadmapUtils.ts`) is the single source of truth for
the thresholds/colors in the table above — used by the grid cells, the
sidebar peak badge, and both drill-down panels, so a percentage always
reads the same color everywhere in the UI.
