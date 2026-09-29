export type StatusKey = 'In Progress' | 'At Risk' | 'Planned' | 'Done'
export type ItemType = 'epic' | 'task' | 'milestone' | 'release'
export type ViewKey = 'timeline' | 'cross' | 'resources' | 'costs' | 'compare' | 'settings'
export type ScaleIndex = 0 | 1 | 2 | 3
export type CostUnit = 'month' | 'hour'

export interface Project {
  id: string
  name: string
  desc: string
  owner: string
  category: string
  color: string
  status: StatusKey
}

export interface Assignment {
  r: string
  pct: number
}

export interface Item {
  id: string
  projectId: string
  title: string
  startDay: number
  dur: number
  status: StatusKey
  type: ItemType
  assignments: Assignment[]
  // Roles a person can take this on with (any one of them counts as a fit). Missing/empty means any role can.
  requiredRoles?: string[]
  // Free text (scope, complexity, assumptions, closing notes). Missing means none.
  description?: string
  // Duration estimates, oldest first: the first is the one the item was created
  // with, later ones are explicit re-estimates. Moving or resizing the bar
  // doesn't add one. Missing on milestones/releases and on items created
  // before estimates were recorded.
  estimates?: Estimate[]
  // Day the item was marked Done (same day math as startDay). Set on entering
  // Done, dropped on leaving it; missing on items that were Done before this
  // was recorded.
  completedDay?: number
  // Timeline row within its project, set by dragging the bar up or down.
  // Missing means the automatic layout (first free row). See src/lib/lanes.ts.
  lane?: number
}

export interface Estimate {
  dur: number // calendar days, like Item.dur
  at: string // ISO timestamp
  reason?: string
  // Set when the duration came from the "Suggest duration" assistant, so its
  // accuracy can be compared with manual estimates.
  source?: 'assistant'
}

// A role in the roles catalog (Settings → Roles): the name is what
// Resource.role / Item.requiredRoles actually store, `icon` is a key into
// the icon registry (src/data/roleIcons.ts).
export interface Role {
  name: string
  icon: string
}

// A stretch of days a person is away (vacation, leave…). Same day math as
// items: `startDay` offset from START_DATE, `dur` calendar days, end exclusive.
export interface TimeOff {
  id: string
  startDay: number
  dur: number
  note?: string
}

export interface Resource {
  id: string
  name: string
  role: string
  cost: number // rate in costUnit terms ($/mo or $/hr)
  costUnit: CostUnit
  // Share of this person's time available for this roadmap, 0-100. Missing means 100.
  availability?: number
  // Days away: capacity 0 on those days. Missing means none.
  timeOff?: TimeOff[]
}

export interface Dependency {
  id: string
  from: string
  to: string
}

export interface Sprint {
  id: string
  name: string
  startDay: number
  dur: number
}

export interface Settings {
  workHoursPerDay: number
  currencyCode: string
  currencySymbol: string
  countWeekends: boolean
  holidays: string[] // 'YYYY-MM-DD'
  // Whether a person's time off lowers the cost of their assignments (unpaid).
  // Missing means false: time off is paid, cost is unchanged.
  timeOffReducesCost?: boolean
  // Task titles a new project can start with, in order. Missing means the
  // built-in list (DEFAULT_PROJECT_TASKS); an empty list means none.
  defaultProjectTasks?: string[]
}

// A scenario is a full, independent copy of the planning data below — a
// what-if roadmap variant (add/remove people, shift dates) you can compare
// against others before promoting one to be the official plan.
export interface ScenarioData {
  projects: Project[]
  items: Item[]
  resources: Resource[]
  deps: Dependency[]
  sprints: Sprint[]
  settings: Settings
  roles: Role[]
}

export interface ScenarioMeta {
  id: string
  name: string
  note: string
  createdAt: string // ISO
  basedOn: string | null // scenario id it was duplicated from, or null for the original
}

// Summary numbers used both to compare scenarios and to show how a single
// scenario's estimate evolved across its checkpoint history.
export interface ScenarioMetrics {
  totalCost: number
  endDay: number | null // last day any item ends, or null if the scenario has no items
  overallocated: number // # resources whose peak concurrent allocation exceeds their availability
  headcount: number // # resources with at least one assignment
  itemCount: number
}

// A named snapshot of a scenario's data at a point in time — how you track
// "estimate went up/down because scope changed" over the life of a plan.
export interface CheckpointMeta {
  id: string
  name: string
  note: string
  createdAt: string // ISO
  metrics: ScenarioMetrics
}

export interface Checkpoint extends CheckpointMeta {
  snapshot: ScenarioData
}

export interface Draft extends Item {
  _deps: string[]
  _new?: boolean
  // Duration the assistant suggested for a new item; if it's still the
  // duration on create, the initial estimate is marked as the assistant's.
  _suggested?: number
}

// View filters beyond the date range and per-project visibility (which stays
// in `visible`). Empty lists mean "no restriction"; values within a list are
// OR'ed, different fields are AND'ed. UI state only — never in undo history.
export interface Filters {
  resourceIds: string[]
  roles: string[]
  statuses: StatusKey[]
  types: ItemType[]
  onlyIssues: boolean
  unassigned: boolean // work items with nobody assigned
  uncovered: boolean // items whose required roles nobody assigned has
  focusItemId: string | null // dependency chain of this item
  text: string
  finding: { title: string; itemIds: string[] } | null // items of an Analysis finding ("Show in Timeline")
}

export type FilterListKey = 'resourceIds' | 'roles' | 'statuses' | 'types'

// The filters kept across reloads (view.json). The dependency path and the
// text search are momentary, so they're left out (so is a finding's highlight).
export type PersistedFilters = Omit<Filters, MomentaryFilterKey>
export type MomentaryFilterKey = 'focusItemId' | 'text' | 'finding'

// Everything a saved view restores: the date range, filters and hidden projects.
export interface ViewSnapshot {
  filterStartDay: number | null
  filterEndDay: number | null
  filters: PersistedFilters
  hiddenProjectIds: string[]
}

// A named combination of filters ("Backend Q4", "Risks"), kept in view.json.
export interface SavedView extends ViewSnapshot {
  id: string
  name: string
}

export interface ImpactResult {
  deps: { item: Item; clash: boolean }[]
  resources: { rid: string; before: number; after: number; capacity: number; over: boolean }[]
  projects: string[]
}

export interface RoadmapState {
  view: ViewKey
  pxPerDay: number
  projects: Project[]
  items: Item[]
  resources: Resource[]
  deps: Dependency[]
  sprints: Sprint[]
  settings: Settings
  roles: Role[]
  visible: Set<string>
  expanded: Set<string>
  railOpen: boolean
  panel: 'item' | 'cell' | 'res' | null
  draft: Draft | null
  draftOrig: Item | null
  impact: { show: boolean; draft: Draft; orig: Item | null; imp: ImpactResult } | null
  pform: {
    show: boolean
    id: string | null
    name: string
    desc: string
    owner: string
    category: string
    startStr: string
    endStr: string
    status: StatusKey
    heading?: string
    canDelete?: boolean
    defaultTasks?: boolean
  } | null
  rform: {
    show: boolean
    id: string | null
    name: string
    role: string
    cost: number
    costUnit: CostUnit
    availability: number
    timeOff: TimeOff[]
    heading?: string
    canDelete?: boolean
  } | null
  sform: {
    show: boolean
    id: string | null
    name: string
    startStr: string
    endStr: string
    canDelete?: boolean
  } | null
  scenarios: ScenarioMeta[]
  activeScenarioId: string | null
  officialScenarioId: string | null
  scenarioForm: { show: boolean; name: string; note: string } | null
  historyOpen: boolean
  analysisOpen: boolean
  checkpointForm: { show: boolean; name: string; note: string } | null
  resSel: string | null
  cell: { rid: string; bIdx: number; bucket: { s: number; d: number; label: string } } | null
  contextMenu: { x: number; y: number; projectId: string; day: number; itemId: string | null } | null
  // Items picked with Cmd/Ctrl/Shift-click in the Timeline, for "Copy to…".
  // UI only: not saved, not in undo, cleared on scenario switch.
  selectedIds: string[]
  copyOpen: boolean
  // While a bar is being dragged: which one, how many items move with it,
  // and the change so far in days. UI only, for the live chip on the bar.
  dragInfo: { id: string; count: number; days: number; mode: 'move' | 'resize' } | null
  showDeps: boolean
  filterStartDay: number | null
  filterEndDay: number | null
  filters: Filters
  savedViews: SavedView[]
  // The saved or built-in view last applied, to label the Views menu; cleared by Reset.
  activeViewId: string | null
  toast: { show: boolean; text: string } | null
  viewport: { left: number; width: number }
  tick: number
  _tr: boolean
}
