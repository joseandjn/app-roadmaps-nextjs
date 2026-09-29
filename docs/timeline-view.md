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

- **Click a bar or milestone** → selects it (blue outline); nothing opens.
  **Double-click** it, or press **Enter** with one item selected, → opens the
  item editor in `RightPanel` (`openItem`); the edited item's bar gets a dark
  outline for as long as the panel is open. **Cmd/Ctrl/Shift-click** adds an
  item to or removes it from the selection; clicking empty canvas or **Esc**
  clears it. With two or more selected, a floating bar offers "Copy to…"
  (see `docs/persistence.md`); a single item can be copied from its
  right-click menu. The hover card still shows an item's details without
  opening anything.
- **Drag a bar** (grab anywhere on its body) → reschedules the item live
  as you drag, snapped to whole days. **Drag the bar's right edge** →
  resizes its duration instead. On release, a toast reports how many
  dependency clashes / resource over-allocations the change introduced
  (or "Rescheduled — no conflicts"). Unlike the panel-based edit flow,
  drag changes commit immediately — there's no confirmation step.
- **Drag a bar or milestone up or down** → moves it to another row of its
  project (half a row of movement or more; it can move sideways in the same
  gesture). The row is saved and survives reloads. Dropping on a row that
  already has something at those dates swaps them: that item takes the row
  yours left, so moving a task down past another puts that one above it (and
  moving up, below), with no gap and nothing else pushed around. The first time you do this in a project, every visible item
  of that project keeps the row it's shown in, so nothing else jumps. You can
  drop one row below the last to open a new row. Moving only up/down shows no
  "rescheduled" toast. Undo reverts the whole gesture.
- **Automatic order**: in `ProjectModal`, "Automatic order" (shown only when
  some item of the project has a saved row) forgets the saved rows and goes
  back to the automatic layout.
- **Click a lane header** → opens `ProjectModal` to edit that project.
- Zoom (Toolbar `−`/`+` buttons or the Day/Week/Month/Quarter scale
  presets) and the active date-range filter (FilterBar) both apply here,
  same as the other views.

## Technical description

### Files involved

| File | Role |
|---|---|
| `src/components/views/TimelineView.tsx` | Renders the Gantt grid |
| `src/lib/roadmapUtils.ts` | `pack` (row packing, delegates to `lanes.ts`), `buildHeader` (date header), `deriveScale` |
| `src/lib/lanes.ts` | Row layout with saved rows (`layoutLanes`), vertical moves (`moveToLane`), `clearLanes`; tests in `lanes.test.ts` |
| `src/store/useRoadmapStore.ts` | `openItem`, `editProject`, `startDrag`, `resetProjectLanes`, `showDeps`, `draft` (selection), `_tr` (transition flag) |
| `src/data/initialData.ts` | `STATUS_CONFIG`, `TODAY_DAY` |

### Layout

Same sticky 2×2 CSS-grid pattern used by the other two views: a fixed
top-left corner label, a top header row (date bands + ticks + "Today"
chip, sticky top), a left lane-label column (sticky left,
`LABEL_W = 264px`), and the scrollable canvas. One `<div>` handles both
scroll axes; sticky positioning pins the header/label independently.

### Row packing (`pack()` → `layoutLanes()` in `lanes.ts`)

Occupancy is measured in pixels: a bar takes `dur * ppd` (at least 7px), a
milestone/release 132px for its label, plus an 8px gap, so what fits in a
row depends on the zoom.

1. Items with a saved row (`Item.lane`) are placed first, by lane and then by
   start: each goes to its lane, or the next free one below if something
   there overlaps it.
2. Items without one are placed by start (stable, so same-day items keep
   their list order) in the first free row. With no saved rows at all this is
   exactly the old greedy layout.
3. Rows nobody uses are dropped (`rowLanes` maps visible row → stored lane),
   so filters never leave gaps.

This decides each lane's height (`rowCount * ROW + padding`). `CrossView`'s
expanded lanes reuse the exact same function.

### Bar/milestone geometry

While building the lane, the code records each item's on-screen geometry
in a local `pos` map (`{ x, w, y, right }`), keyed by item id. This is
consumed later, in the same render pass, by the dependency-arrow drawer —
so arrows are always positioned from the bars' actual current coordinates
rather than recomputed independently.

### Drag / resize (`startDrag` in the store)

`onPointerDown` on a bar calls `store.startDrag(id, mode, clientX, rows)`, which
attaches `mousemove`/`mouseup` listeners directly to `window` (outside
React's synthetic event system) and mutates `items` in the store on every
mouse move, computing the day delta from pixel delta ÷ `pxPerDay`. On
`mouseup`, it removes the listeners, recomputes impact via the same
`computeImpact()` the item-editor's save flow uses (dependency clashes +
resource peak-allocation deltas), and shows a toast with the conflict
count. The change is already committed to `items` by this point — the
toast is purely informational, not a confirmation gate.

For a move, the Timeline also passes `rows`: the pointer's Y, the row
height, the item's visible row, the project's `rowLanes` and the lane every
visible item of the project is shown in. Each pointer move starts over from
the project's items as they were when the drag began: if the pointer is a row
or more away, `moveToLane` pins every visible item to its shown lane, puts the
dragged one in the target lane (`laneForRow`) and gives overlapping items in
that lane the lane it left (a swap). The item editor doesn't edit `lane`: `commitItem` keeps
the item's current one, so saving the panel after a drag doesn't undo it.

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
