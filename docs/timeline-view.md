# Timeline View

The "Timeline" tab is the default view: a per-project Gantt chart. Each
visible project gets its own swimlane; items within a lane are packed into
sub-rows so overlapping work never overlaps visually.

## Functional description

### What you see

- One lane per visible project (hidden projects — unchecked in the
  sidebar — are skipped entirely, not just dimmed; their lane doesn't take
  up space).
- Each lane header shows the project's color dot, name, owner, and item
  count, and is clickable to open `ProjectModal` for that project.
- Items render as bars sized by duration, colored by status (`In Progress`
  / `At Risk` / `Planned` / `Done`), positioned by start day. **Epics** get
  a bolder label; **milestones/releases** (zero-duration items) render as
  a small rotated-square marker instead of a bar — filled for a release,
  outlined for a milestone.
- An **epic currently "In Progress"** shows a translucent fill inside its
  bar proportional to how much of its duration has elapsed (today vs.
  start/duration) — a lightweight, always-live progress indicator with no
  stored "progress" field behind it.
- A vertical red line + "Today" chip in the header marks the current date.
- **Dependency arrows** (toggle via the "Dependencies" button in the
  Toolbar, only shown on this tab): curved connector lines from each
  prerequisite item's end to its dependent item's start, with an
  arrowhead. A connector turns red/dashed if the prerequisite finishes
  *after* the dependent is scheduled to start (a date clash), or if it's
  part of a dependency cycle.

### How you interact with it

- **Click a bar or milestone** → opens the item editor in `RightPanel`
  (`openItem`). The selected item's bar gets a highlighted outline for as
  long as the panel is open.
- **Drag a bar** (grab anywhere on its body) → reschedules the item live
  as you drag, snapped to whole days. **Drag the bar's right edge** →
  resizes its duration instead. On release, a toast reports how many
  dependency clashes / resource over-allocations the change introduced
  (or "Rescheduled — no conflicts"). Unlike the panel-based edit flow,
  drag changes commit immediately — there's no confirmation step.
- **Click a lane header** → opens `ProjectModal` to edit that project.
- Zoom (Toolbar `−`/`+` buttons or the Day/Week/Month/Quarter scale
  presets) and the active date-range filter (FilterBar) both apply here,
  same as the other views.

## Technical description

### Files involved

| File | Role |
|---|---|
| `src/components/views/TimelineView.tsx` | Renders the Gantt grid |
| `src/lib/roadmapUtils.ts` | `pack` (row packing), `buildHeader` (date header), `deriveScale` |
| `src/store/useRoadmapStore.ts` | `openItem`, `editProject`, `startDrag`, `showDeps`, `draft` (selection), `_tr` (transition flag) |
| `src/data/initialData.ts` | `STATUS_CONFIG`, `TODAY_DAY` |

### Layout

Same sticky 2×2 CSS-grid pattern used by the other two views: a fixed
top-left corner label, a top header row (date bands + ticks + "Today"
chip, sticky top), a left lane-label column (sticky left,
`LABEL_W = 264px`), and the scrollable canvas. One `<div>` handles both
scroll axes; sticky positioning pins the header/label independently.

### Row packing (`pack()` in `roadmapUtils.ts`)

Each project's items are laid out with a greedy interval-scheduling
algorithm: sort items by `startDay`, track each existing sub-row's
current right edge (`rows: number[]`), and place each item in the first
row whose right edge is `<=` the item's left edge; otherwise open a new
row. This is what allows two items in the same project to sit
side-by-side only when their date ranges don't overlap, and determines
each lane's height (`rowCount * ROW + padding`). `CrossView`'s expanded
lanes reuse the exact same function.

### Bar/milestone geometry

While building the lane, the code records each item's on-screen geometry
in a local `pos` map (`{ x, w, y, right }`), keyed by item id. This is
consumed later, in the same render pass, by the dependency-arrow drawer —
so arrows are always positioned from the bars' actual current coordinates
rather than recomputed independently.

### Drag / resize (`startDrag` in the store)

`onMouseDown` on a bar calls `store.startDrag(id, mode, clientX)`, which
attaches `mousemove`/`mouseup` listeners directly to `window` (outside
React's synthetic event system) and mutates `items` in the store on every
mouse move, computing the day delta from pixel delta ÷ `pxPerDay`. On
`mouseup`, it removes the listeners, recomputes impact via the same
`computeImpact()` the item-editor's save flow uses (dependency clashes +
resource peak-allocation deltas), and shows a toast with the conflict
count. The change is already committed to `items` by this point — the
toast is purely informational, not a confirmation gate.

### Dependency arrows

Only rendered when `showDeps` is true. Steps, per render:

1. Build an adjacency list from `deps` and run a DFS over it to flag
   edges that close a cycle (a self-referential dependency chain).
2. For each `Dependency` edge `{ from, to }` (`from` = the item that has
   the dependency, `to` = the prerequisite it depends on — same
   convention used in `RightPanel`'s "Depends on" list), look up both
   items' recorded `pos` and skip the edge if either is off-screen.
3. Flag a **clash** if the prerequisite (`to`) ends *after* the dependent
   (`from`) starts: `(itTo.startDay + itTo.dur) > itFrom.startDay`.
4. Draw a cubic Bézier SVG path from the prerequisite's right edge to the
   dependent's left edge, red/dashed with a filled-red arrowhead marker if
   `clash || cycle`, otherwise gray/solid.

### Zoom / scale

The Toolbar's Day/Week/Month/Quarter buttons call `setScale(i)`, which
sets `pxPerDay` to one of the four `SCALE_PRESETS` (`[46, 17, 6.5, 2.4]`).
The `−`/`+` buttons call `zoom(factor)`, multiplying `pxPerDay`
continuously (clamped to `[1.8, 70]`). Either way, `deriveScale(pxPerDay)`
maps the current pixel-per-day value back to a discrete scale index
(0 = day, 1 = week, 2 = month, 3 = quarter) that `buildHeader()` uses to
decide header granularity — so the header always matches the actual zoom
level, not just which toolbar button was last clicked. Scale/zoom changes
also flip the store's transient `_tr` flag briefly, which applies a CSS
transition to bar position/width so items animate to their new place
instead of jumping.

### Visibility & filtering

Only projects in the store's `visible` Set get a lane at all (fully
excluded, unlike the sidebar where hidden projects just dim). The visible
date window is `[filterStartDay ?? 0, usePlanEnd())`; items
entirely outside it are skipped from rendering (but still contribute to
`pack()`'s row layout for the lane).

The FilterBar filters go through `itemMatch()` (see `docs/filters.md`):

- `'hide'` items (status, type, only issues, gaps) are left out before
  `pack()`, so rows compact; with those filters a lane left empty is
  dropped, and if none remain `FilterEmptyState` shows with a Reset button.
  The lane's "N items" counts what's shown.
- `'dim'` items (people, roles, dependency path, text search) render at
  `DIM_OPACITY`, except the selected one.
- Dependency clashes are computed from **all** items, so a filter never
  hides a clash flag on a remaining bar. While a dependency path is focused,
  only the chain's arrows are drawn, even with the Dependencies toggle off.
- Every bar carries `data-item-id`, which the search box uses to scroll to
  and flash the next match.
