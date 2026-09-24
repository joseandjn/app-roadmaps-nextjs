# Filters

The FilterBar (under the Toolbar) narrows every view to a slice of the plan:
a date range, projects, people, roles, status, type, problems, gaps, a
dependency path and a text search. Filters are UI state only — they never
touch scenario data and never enter undo/redo history.

## Functional description

### The filters

| Filter | Where | An item passes when… | Effect |
|---|---|---|---|
| **Date range** | Two date inputs | — (clips the canvas, see `docs/components.md`) | Clip |
| **Projects** | Projects chip, or the color square in the LeftRail | its project is visible | Hide |
| **Status** | Status chip ("Hide Done" shortcut) | its status is one of those picked | Hide |
| **Type** | Type chip ("Executive view" shortcut: epic, milestone, release) | its type is one of those picked | Hide |
| **Only issues** | Toggle, with a live count | it has a dependency clash, an overloaded or wrong-role assignee, or is At Risk | Hide |
| **Gaps** | Gaps chip: *Unassigned* / *Required role not covered* | it has either gap picked (epic/task with nobody on it; required roles nobody assigned has) | Hide |
| **People** | People chip, or the funnel button per person in the Resources LeftRail | someone picked is assigned to it | Dim |
| **Roles** | Roles chip | it requires one of the roles, or someone with one of them is assigned | Dim |
| **Dependency path** | Item context menu / item panel → "Show dependency path"; chip "Path: …" | it's the item or one of its transitive predecessors/successors | Dim |
| **Text search** | Search box (`/` or Cmd/Ctrl+F) | its title or its project's name contains the text (case- and accent-insensitive) | Dim |

Values within one filter are OR'ed; different filters are AND'ed
(`Status ∈ {At Risk, In Progress}` **and** `People ∈ {Ana, Luis}`).

### Hide vs. dim

- **Hide** removes the item. Timeline and Cross re-pack rows and drop
  lanes that end up empty.
- **Dim** keeps the item where it is at 25% opacity, still clickable and
  draggable, so dependency context isn't lost. In the Timeline the selected
  item is never dimmed.
- In **Resources**, People and Roles show only the matching people's rows
  instead of dimming.

### What respects the filters

| Place | Behaviour |
|---|---|
| Timeline, Cross | Hide/dim as above. Dependency clashes are still computed from all items. |
| Resources | Load counts only non-hidden items (dimmed ones count). The color uses the **full** load when that is over capacity, and cells with load outside the filters get a dashed border — a filter never hides a real overload. See `docs/resources-view.md`. |
| Costs | Totals, by project and by person count only non-hidden items and the matching people's assignments. The monthly run-rate stays whole-team, marked "Whole team, not filtered". |
| Compare, checkpoints, Analysis | **Ignore** filters — they measure the whole plan. |

When the filters leave nothing to show, every view displays "No items match
the filters" with a **Reset** button.

### Other controls

- **Reset** clears everything: dates, all filters, and shows every project.
- The **filtered · N** pill counts active filters (the two gap options count
  as one).
- **Views** menu: ready-made views ("Risks and issues", "Executive", "Gaps")
  and your own saved ones. A view restores the date range, filters and hidden
  projects; if you change something afterwards it reads "(modified)".
- **Search**: Enter jumps to the next match drawn in the current view
  (Shift+Enter to the previous), the box shows "2/5". Esc clears it.
- **Voice**: "only Ana's work", "what's at risk in project X", "remove the
  filters" — see `docs/voice-agent.md` → Filters.
- On windows narrower than 1600px the chips collapse into a single
  **Filters · N** button; dates, search, Views and the path chip stay out.

### What's saved

`storage/view.json` keeps the date range, filters and hidden projects across
reloads, plus saved views. The dependency path and the text search are
momentary and not saved. Filters are **global**, not per scenario: switching
scenarios keeps them, and ids that don't exist there are dropped.

## Technical description

### Files

| File | Role |
|---|---|
| `src/types/index.ts` | `Filters`, `PersistedFilters`, `ViewSnapshot`, `SavedView` |
| `src/lib/filters.ts` | All the rules: `itemMatch`, `resourceMatches`, `itemsForMetrics`, `colorLoad`, `hidesItems`, `activeFilterCount`, `itemIssues`, `dependencyChain`, `matchesText`, `pruneFilters`, `BUILTIN_VIEWS` |
| `src/lib/useFilterContext.ts` | Builds the memoized `FilterContext` (filters, visible, resources, issues, chain, projects) views pass to `itemMatch` |
| `src/store/useRoadmapStore.ts` | `filters`, `visible`, `setFilters`, `toggleFilterValue`, `setVisibleProjects`, `clearFilter`, saved-view actions |
| `src/components/FilterBar.tsx` | Layout; collapses chips into `FiltersGroup` below 1600px |
| `src/components/filters/*` | One component per chip, plus `FilterChip` (generic multi-select popover), `SearchBox`, `PathChip`, `ViewsMenu`, `FiltersGroup`, `FilterEmptyState` |
| `src/lib/persistence/viewFile.ts`, `viewPayload.ts` | Sanitizing and saving `view.json` |

### Rules live in one place

Views never re-implement filtering. They call:

- `itemMatch(item, ctx)` → `'show' | 'dim' | 'hide'` to draw items;
- `itemsForMetrics(items, ctx)` for load and cost (drops only `'hide'`);
- `resourceMatches(r, filters)` for Resources rows and Costs people;
- `hidesItems(filters)` to decide whether empty lanes are dropped.

Projects stay in the store's `visible` Set (the source of truth the
create/restore/load flows already maintained); the Projects chip and the
"By category/owner" shortcuts just edit it via `setVisibleProjects`
(`[]` = all).

### Keeping ids valid

A single `subscribe` at the end of the store runs `pruneFilters` whenever
`items`, `resources` or `roles` change — covering deletes, undo/redo,
checkpoint restore and scenario switches — so a filter never points at
something that no longer exists. `renameRole` renames the role inside the
filter too.

### Persistence

`useRoadmapPersistence` saves the view (debounced) when the date range,
`visible`, saved views or a **persisted** part of `filters` changes — typing
a search or focusing a path doesn't rewrite `view.json`. On boot the view is
applied after the scenario data so unknown ids can be dropped. See
`docs/persistence.md` → `view.json`.
