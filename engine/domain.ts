export type ItemStatus = 'In Progress' | 'At Risk' | 'Planned' | 'Done'
export type ItemType = 'epic' | 'task' | 'milestone' | 'release'
export type Locale = 'es' | 'en'

export interface EngineProject {
  id: string
  name: string
}

export interface EngineResource {
  id: string
  name: string
  role?: string
  // Rate in `costUnit` terms (per calendar month, or per hour). Cost analysis is skipped without it.
  cost?: number
  costUnit?: 'month' | 'hour'
}

export interface EngineSprint {
  id: string
  name: string
  startDay: number
  dur: number
}

export interface EngineAssignment {
  r: string
  pct: number
}

// Dates are integer day offsets from `originDate` (see AnalyzeRequest), the
// same representation the roadmap app uses.
export interface EngineItem {
  id: string
  projectId: string
  title: string
  startDay: number
  dur: number
  status: ItemStatus
  type: ItemType
  assignments: EngineAssignment[]
}

// `from` depends on `to`: `to` must finish before `from` starts.
export interface EngineDependency {
  id: string
  from: string
  to: string
}

export interface EngineSettings {
  countWeekends: boolean
  holidays: string[]
  workHoursPerDay?: number
  currencySymbol?: string
}

export interface RoadmapSnapshot {
  projects: EngineProject[]
  items: EngineItem[]
  resources: EngineResource[]
  deps: EngineDependency[]
  sprints?: EngineSprint[]
  settings: EngineSettings
}

export function isInstant(item: Pick<EngineItem, 'type'>): boolean {
  return item.type === 'milestone' || item.type === 'release'
}

export function itemEnd(item: Pick<EngineItem, 'type' | 'startDay' | 'dur'>): number {
  return isInstant(item) ? item.startDay : item.startDay + item.dur
}
