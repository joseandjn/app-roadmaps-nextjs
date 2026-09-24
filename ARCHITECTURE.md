# Architecture

Roadmap Management — a single-page, client-rendered roadmap and resource
planning tool built on Next.js. Most state lives in the client Zustand
store; the domain data (`projects`/`items`/`resources`/`deps`) is
persisted to a JSON file on disk through one small API route — see
"Persistence" below. Everything else (view, filters, zoom, panels) stays
in-memory and resets on reload.

## Stack

- **Next.js 16** (App Router, Turbopack) — see `AGENTS.md`: this project
  pins a version whose APIs may differ from prior Next.js knowledge; check
  `node_modules/next/dist/docs/` before relying on assumptions.
- **React 19**
- **Zustand 5** — single global store, no server state / no React Context
- **Tailwind CSS v4** (`@tailwindcss/postcss`) + shadcn/ui conventions
  (`components.json`, `zinc` base color, `cn()` helper)
- **Radix UI** primitives (dialog, select, scroll-area, separator) under
  `src/components/ui/`
- TypeScript, path alias `@/*` → `src/*` (`tsconfig.json`)

## Directory layout

```
src/
├── app/                      Next.js App Router entry
│   ├── layout.tsx            Root HTML shell, page metadata
│   ├── page.tsx               Composes the whole UI from the store's `view`
│   ├── globals.css           Tailwind entry + global styles
│   └── api/
│       ├── scenarios/         Scenarios and their checkpoints: list/create, GET/PUT/DELETE, promote, restore (see "Persistence" below)
│       ├── view/
│       │   └── route.ts       GET/PUT view state: active scenario, date range, filters, saved views
│       └── voice-command/
│           └── route.ts       POST a transcript, get back a structured action (see "Voice Agent" below)
│
├── components/
│   ├── Toolbar.tsx            Top bar: view switcher, zoom/scale, date range, "New project"
│   ├── FilterBar.tsx          Secondary bar: views, date range, search and filter chips (see docs/filters.md)
│   ├── filters/               One component per filter chip, plus search, saved views and the empty state
│   ├── LeftRail.tsx           Sidebar: project list or people list (see "Shared Components" below)
│   ├── RightPanel.tsx         Slide-in drawer: item editor / resource detail / cell detail
│   ├── Toast.tsx              Transient notification (e.g. "Item updated")
│   ├── modals/
│   │   ├── ProjectModal.tsx   Create/edit/delete a project, optionally seeding default tasks (see "Shared Components" below)
│   │   ├── ResourceModal.tsx  Create/edit/delete a person
│   │   └── ImpactModal.tsx    Shows dependency clashes / over-allocation before committing an item edit
│   ├── views/
│   │   ├── TimelineView.tsx   Per-project Gantt (see "TimelineView" below)
│   │   ├── CrossView.tsx      All projects overlaid (see "Cross-Project View" below)
│   │   └── ResourcesView.tsx  Per-person allocation grid (see "ResourcesView" below)
│   └── ui/                    shadcn/Radix primitives: button, dialog, select, badge, separator, scroll-area
│
├── store/
│   └── useRoadmapStore.ts    Single Zustand store — all app state + actions (see below)
│
├── lib/
│   ├── roadmapUtils.ts        Domain logic: date math, timeline header/gridline
│   │                           generation, item packing into rows, resource
│   │                           peak-allocation calc
│   ├── utils.ts               `cn()` (clsx + tailwind-merge)
│   ├── filters.ts             Filter rules: itemMatch, resourceMatches, itemsForMetrics… (see docs/filters.md)
│   ├── useFilterContext.ts    Memoized FilterContext the views pass to itemMatch
│   ├── persistence/            (see "Persistence" below)
│   │   ├── scenarioFile.ts     Server-only: scenario index + data files
│   │   ├── checkpointFile.ts   Server-only: per-scenario checkpoint history
│   │   ├── viewFile.ts         Server-only: storage/view.json, sanitized
│   │   ├── scenarioActions.ts  Client helpers: switch/create/promote scenarios, checkpoints
│   │   ├── viewPayload.ts      Builds the view.json PUT body from the store
│   │   └── useRoadmapPersistence.ts  Client hook: boot, debounced saves on change
│   ├── agent/                  (see "Voice Agent" below)
│   │   ├── shared.ts            Tool definitions + system prompt (shared by both providers)
│   │   ├── roadmapAgent.ts      Picks the active provider (Ollama by default, or Claude)
│   │   └── providers/
│   │       ├── ollama.ts         Calls local Ollama's /api/chat with tools
│   │       └── anthropic.ts      Calls Claude's Messages API with tools
│   └── voice/                  (see "Voice Agent" below)
│       ├── speechRecognition.ts  Ambient types for the browser's Web Speech API
│       └── useVoiceCommand.ts    Client hook: mic capture → API call → store dispatch
│
├── data/
│   └── initialData.ts         Seed data: projects, items, resources, deps,
│                               plus constants (date origin, scale presets, status config)
│
└── types/
    └── index.ts                Shared types: Project, Item, Resource, Dependency,
                                  Draft, RoadmapState, etc.

storage/                        Gitignored, created on first run
├── view.json                   Active scenario, date range, filters, hidden projects, saved views
└── scenarios/
    ├── index.json              Scenario list + officialId
    ├── <id>.json               A scenario's planning data
    └── <id>.checkpoints.json   Its checkpoints (snapshot + metrics)
```

## State management

Everything — UI state and domain data — lives in one Zustand store
(`useRoadmapStore.ts`), created with `create<Store>()`. It holds:

- **Domain data**: `projects`, `items`, `resources`, `deps`
- **View state**: `view` (`'timeline' | 'cross' | 'resources'`), `pxPerDay`
  (zoom level), `visible`/`expanded` project sets, `viewport`
- **Editing state**: `draft` (item being created/edited), `pform`/`rform`
  (project/resource form state), `impact` (pending change + computed
  conflicts), `cell` (selected resource-allocation cell)
- **Ephemeral UI**: `toast`, `panel` (which drawer is open), `_tr`/`tick`
  (transition flags for zoom animations)

Components read via `useRoadmapStore(selector)` and call actions directly
off the store (e.g. `onSaveItem`, `startDrag`, `toggleProject`). There's no
reducer/dispatch layer — actions are plain functions closing over `set`/`get`.

Dates are represented as integer day offsets (`startDay`, `dur`) from a
fixed origin (`START_DATE` in `initialData.ts`), not `Date` objects, so
Gantt-bar math stays cheap integer arithmetic; `roadmapUtils.ts` converts
to/from real dates only at the display/input boundary.

## Editing flow (item example)

1. `openItem(id)` clones the item into `draft` and opens `RightPanel`.
2. Panel fields call `patchDraft`/`onDraft*` to mutate the draft in place.
3. `onSaveItem` computes an `ImpactResult` (dependency clashes, resource
   over-allocation) via `computeImpact` and opens `ImpactModal`.
4. `commitItem` (from the modal) writes the draft into `items`/`deps` and
   closes both panel and modal.

Dragging a bar on the timeline (`startDrag`) follows the same
compute-impact-then-toast pattern, but commits immediately and reports
conflicts via `Toast` rather than blocking on the impact modal. The drop's
trailing `click` is suppressed (`didDrag()`) so it doesn't also open the
editor; a plain click without movement still does.

## Undo / redo

Cmd/Ctrl+Z undoes, Cmd/Ctrl+Shift+Z (or Ctrl+Y) redoes
(`src/lib/history/useUndoShortcuts.ts`, mounted from `page.tsx`). History
lives at module scope in `useRoadmapStore.ts` as reference-only snapshots of
the six persisted slices (`projects`, `items`, `resources`, `deps`,
`sprints`, `settings`), capped at 100. A store subscriber records the
previous snapshot on any change to those slices, so every action — including
voice-agent mutations — is undoable. Drags are the exception: they fire an
update per pointermove, so `beginGesture`/`endGesture` collapse each drag into
one step. Undo/redo just write the snapshot back; the persistence hook then
auto-saves it like any other change. History is cleared whenever a scenario is
loaded (boot, scenario switch, checkpoint restore), and the shortcuts are
ignored while typing in a field or while a modal/form is open.

## Analysis engine

> Full writeup: [`engine/README.md`](engine/README.md)

`engine/` (a sibling of `src/`, deliberately outside it) analyzes the roadmap
and finds inefficiencies: overloaded people, idle paid capacity (with its cost),
dependency conflicts and cycles, each group's critical path with the idle time
between links, and tasks that don't fit their sprint. It is plain
TypeScript with no web-framework or `src/` imports (enforced by ESLint), so it
can become its own API service. The web app reaches it through one thin route,
`POST /api/analyze`, and the ✦ toolbar button opens `AnalysisModal`, which
shows the deterministic findings immediately and then an LLM summary
(Ollama by default, Claude with `LLM_PROVIDER=anthropic`). It is read-only:
it never changes the roadmap. Each finding about specific items has a "Show
in Timeline" button that highlights them there (a momentary filter, see
[`docs/filters.md`](docs/filters.md)).

## Persistence

> Full functional + technical writeup: [`docs/persistence.md`](docs/persistence.md)

Planning data is saved per **scenario** as JSON under `storage/scenarios/`
(one of them marked official), each with its own checkpoint history. How
you're looking at it (active scenario, date range, filters, hidden
projects, saved views) goes to `storage/view.json`. Next.js Route Handlers
under `src/app/api/scenarios/` and `src/app/api/view/` read and write these
files. A client hook (`useRoadmapPersistence`, called once from `page.tsx`)
loads the active scenario and then the view on mount, and debounce-saves
whenever the planning data or the persisted view state changes reference.
UI-only state (open panels, drafts, zoom, search) never triggers a write.
No database — just JSON files, written atomically.

## Voice Agent

> Full functional + technical writeup: [`docs/voice-agent.md`](docs/voice-agent.md)

A mic button in the Toolbar captures one spoken command (browser Web Speech
API), sends the transcript to `POST /api/voice-command`, and an LLM maps it
to one of nine tools — create/update/show a resource, create/update/show a
project, jump to a date, or request deletion of either — resolving spoken
names against the current roadmap data. Deletion is human-in-the-loop by
construction: the delete tools only open the existing edit panel (with its
"Remove" button), reusing the same UI flow a manual click would — voice
never deletes anything by itself. Defaults to a local Ollama model (no API
key, no cost); set `LLM_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` to use
Claude instead. Both providers share one set of tool definitions
(`src/lib/agent/shared.ts`) and return the same result shape, so the
route/hook/store layers don't know or care which one ran.

## Shared Components

> Full functional + technical writeup: [`docs/components.md`](docs/components.md)

`FilterBar`, `LeftRail`, and `ProjectModal` are mounted once, outside the
`view` switch in `page.tsx`, and stay reachable from all three tabs —
unlike the one-per-tab view components above. `FilterBar` edits the
store's shared filters — date range, projects, people, roles, status, type,
issues, gaps, dependency path and text search — which every view applies
through `src/lib/filters.ts` (see [`docs/filters.md`](docs/filters.md));
`LeftRail` is a single component with two render modes (project list vs.
people list) switched on the current `view`. `ProjectModal` handles both
create and edit for a project; on create, an "Add default tasks" checkbox
(on by default) seeds four sequential tasks — Desarrollo, Certificación,
Gestión de pase, Pase a PRD — spread across the modal's own Start/End
range, appended to `items` in the same store update as the project itself.

## TimelineView

> Full functional + technical writeup: [`docs/timeline-view.md`](docs/timeline-view.md)

The default view: one swimlane per project, items packed into sub-rows
(`pack()` in `roadmapUtils.ts`) and laid out as Gantt bars/milestone
markers colored by status. Supports drag-to-reschedule and
drag-to-resize directly on bars, click-to-edit via `RightPanel`, and an
optional dependency-arrow overlay (curved SVG paths, flagged red when a
dependency date-clashes or is part of a cycle).

## Cross-Project View

> Full functional + technical writeup: [`docs/cross-view.md`](docs/cross-view.md)

All visible projects overlaid on one shared timeline. Each project
collapses to a single envelope bar (its overall date span) with thin
ticks showing item density, or expands to the same per-item bar layout
`TimelineView` uses. A sweep-line algorithm highlights, with hatched
bands, any stretch of time where 2+ projects are running concurrently.

## ResourcesView

> Full functional + technical writeup: [`docs/resources-view.md`](docs/resources-view.md)

`src/components/views/ResourcesView.tsx` renders the "Resources" tab: one
row per person, one column per time bucket, each cell showing that
person's total allocation % for that bucket plus a breakdown by project.

- **Layout**: a sticky 2×2 CSS grid — top-left corner label, top-right
  scrolling time header, bottom-left sticky column of person rows
  (`LABEL_W = 264px`), bottom-right the allocation canvas. Row height is
  fixed (`RH = 46px`).
- **Time buckets**: `buckets(scaleIndex, baseDay, lastDay)` from
  `roadmapUtils.ts` splits the visible date range (respecting the
  toolbar's date-range filter) into day/week/month/quarter buckets
  depending on zoom (`deriveScale(pxPerDay)`); the header bands/gridlines
  reuse `buildHeader`, the same helper the Gantt views use.
- **Per-cell computation**: for each resource × bucket, it scans every
  `Item`, keeps ones whose `[startDay, startDay+dur)` overlaps the
  bucket's range, and sums `assignment.pct` for that resource into a
  `total` (shown as e.g. "73%") and a `pAgg` map of per-project totals
  (drives the little colored segments under the percentage, sized via
  `flexGrow: pAgg[pid]` using each project's `color`).
- **Cell color**: `allocColor(total)` (in `roadmapUtils.ts`) buckets the
  percentage into under-50 / 50–85 / 85–100 / over-100 (over-allocated)
  styles.
- **Interaction**: clicking a cell calls `openCell(rid, bIdx, bucket)`,
  which opens `RightPanel` in `'cell'` mode with that resource/bucket's
  detail. Scroll position is synced to the store's `viewport` so header
  and canvas scroll together; on mount the view auto-scrolls to center
  "today", and resets to the left edge whenever the date-range filter
  changes.

## Path aliases

`@/*` maps to `src/*` (see `tsconfig.json` and `components.json`), used
throughout for imports (`@/store/...`, `@/components/...`, `@/lib/...`,
`@/data/...`, `@/types`).

## Running

```
npm run dev     # Next.js + Turbopack dev server, http://localhost:3000
npm run build
npm run start
npm run lint
```

### Environment variables (voice agent only)

Everything else runs with zero configuration. Only the [Voice Agent](docs/voice-agent.md)
reads env vars, and only if you want to change its defaults:

| Var | Default | Purpose |
|---|---|---|
| `LLM_PROVIDER` | `ollama` | `ollama` or `anthropic` |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama-only |
| `OLLAMA_MODEL` | `qwen2.5:latest` | Ollama-only — must be a tool-capable model |
| `ANTHROPIC_API_KEY` | — | Required only when `LLM_PROVIDER=anthropic` |
