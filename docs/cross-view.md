# Cross-Project View

The "Cross-Project" tab is a portfolio-level overlay: every visible
project compressed onto one shared timeline, so you can see how projects
run in parallel and where several of them compete for the same window —
without the per-item detail `TimelineView` shows by default.

## Functional description

### What you see

- One lane per visible project. **Collapsed** (the default), a lane shows
  a single **envelope bar** spanning from that project's earliest item
  start to its latest item end, labeled with the project's short name —
  plus a row of thin, semi-transparent, status-colored ticks beneath it,
  one per item, giving a compressed "signature" of how the project's work
  is distributed in time without reading any titles.
- **Expanded**, a lane grows to show full per-item bars and milestone
  markers — visually identical to `TimelineView`'s bars (same status
  colors, epic/task weighting, milestone diamonds), packed into sub-rows
  with the same row-packing algorithm.
- **Overlap bands**: wherever two or more projects' overall date ranges
  are running at the same time, a diagonal-hatched band is drawn across
  the full height of the canvas — a portfolio-level "contention" cue that
  exists independent of any single project's row.
- Today line/chip, zoom, and the active date-range filter behave the same
  as `TimelineView`. There's no dependency-arrow toggle here — the
  Toolbar only shows that control on the Timeline tab.

### How you interact with it

- **Click a lane's header or its envelope bar** → toggles that project
  between collapsed and expanded (`toggleExpand`). Clicking one of the
  collapsed ticks does the same — it isn't a per-item click yet.
- **Click an item bar/milestone while expanded** → opens the item editor
  in `RightPanel` (`openItem`), same as `TimelineView`. There's no drag
  support here, though — items aren't reschedulable from this view.

## Technical description

### Files involved

| File | Role |
|---|---|
| `src/components/views/CrossView.tsx` | Renders the overlay grid |
| `src/lib/roadmapUtils.ts` | `pack` (shared with `TimelineView`), `buildHeader`, `deriveScale` |
| `src/store/useRoadmapStore.ts` | `expanded` Set, `toggleExpand`, `openItem`, `visible` |
| `src/data/initialData.ts` | `STATUS_CONFIG`, `TODAY_DAY` |

### Layout

Same sticky 2×2 grid pattern as `TimelineView`/`ResourcesView`: fixed
corner label, sticky-top date header, sticky-left lane-label column
(`LABEL_W = 264px`), scrollable canvas. No dependency-arrow SVG layer here.

### Envelope + lane sizing

Before the main render loop, the component computes each visible
project's overall range: `{ a: min(item.startDay), b: max(item.startDay +
item.dur) }` across all its items (projects with zero items are skipped
entirely). This range is what the collapsed envelope bar spans, and it's
computed once up front (`ranges` array) so the later overlap-band sweep
doesn't depend on render-loop-local mutable state.

Lane height is `RH = 58` when collapsed, or `RH + rowCount * ROW + 10`
when expanded — `rowCount` coming from the same `pack()` call
`TimelineView` uses on that project's own items.

### Collapsed rendering

For items intersecting the visible date window, a thin rounded bar
(`min-width 3px`, `height 8px`, 50% opacity, colored via
`STATUS_CONFIG[status].dot`) is drawn at a fixed vertical offset under
the envelope bar. These ticks are purely visual density indicators — they
carry no click behavior of their own beyond re-triggering the lane's
expand toggle.

### Expanded rendering

Reuses effectively the same bar/milestone JSX as `TimelineView` (status
color, epic-vs-task font weight, milestone diamond markers for
zero-duration items), but intentionally omits two things `TimelineView`
has: the in-progress-epic elapsed-time fill, and drag/resize handlers —
this view is read/navigate-only for individual items.

### Overlap-band algorithm

A classic sweep-line over interval start/end events:

1. For each project's `[a, b)` range, push a `(a, +1)` and `(b, -1)`
   event.
2. Sort all events by position (ties broken so starts are processed
   before ends at the same coordinate).
3. Walk the sorted events accumulating a running `cnt` of currently-open
   project ranges; whenever `cnt` crosses from below 2 to `>= 2`, note the
   start of an overlap segment, and whenever it drops back below 2, close
   the segment and emit a hatched band spanning `[segStart, x)`.

Bands are rendered across the **full canvas height** (`y`, the final
accumulated lane height after the main loop, not just the overlapping
projects' own lanes), underneath the item bars but above the lane
background stripes/gridlines — so the visual read is "these columns have
2+ projects active," independent of which specific lanes those are.

### Zoom, scale, filtering

Identical mechanics to `TimelineView`: `pxPerDay` set via the Toolbar's
scale presets or zoom buttons, `deriveScale(pxPerDay)` picks the header
granularity for `buildHeader()`, and the visible window is clamped to
`[filterStartDay ?? 0, usePlanEnd())`. The `_tr` transition
flag is read here too, so expand/collapse and zoom changes animate bar
position/width the same way they do in `TimelineView`.

FilterBar filters apply as in the Timeline (`docs/filters.md`): envelopes,
ticks and expanded bars are built from the items `itemMatch()` doesn't hide,
so a project whose items are all hidden has no lane; dimmed items render
faded (ticks and expanded bars). `FilterEmptyState` shows when nothing is
left. Ticks and expanded bars carry `data-item-id` for the search box.
