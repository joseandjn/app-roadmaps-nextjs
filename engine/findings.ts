import type { ItemStatus } from './domain.ts'

export type Severity = 'high' | 'medium' | 'low'
export type FindingKind =
  | 'dependency_cycle' | 'dependency_conflict' | 'overload' | 'critical_path'
  | 'idle_capacity' | 'unassigned_resources' | 'sprint_spillover' | 'oversized_items'

export interface ItemRef {
  id: string
  title: string
  projectId: string
}

interface FindingBase {
  id: string
  severity: Severity
  // Comparable only within the same kind; used to order findings of equal severity.
  score: number
  title: string
  detail: string
}

export interface OverloadFinding extends FindingBase {
  kind: 'overload'
  evidence: {
    resourceId: string
    resourceName: string
    startDay: number
    endDay: number
    startDate: string
    endDate: string
    workingDays: number
    peakPct: number
    // Sum over the window of (load - 100%) in person-days: how much work exceeds capacity.
    excessPersonDays: number
    // Items assigned during the window. `slackDays` is how far the item can slip
    // without delaying a dependent, or null when it isn't part of any dependency chain.
    items: Array<ItemRef & { pct: number; slackDays: number | null }>
  }
}

export interface DependencyConflictFinding extends FindingBase {
  kind: 'dependency_conflict'
  evidence: {
    predecessor: ItemRef & { endDay: number; endDate: string }
    successor: ItemRef & { startDay: number; startDate: string }
    overlapDays: number
  }
}

export interface DependencyCycleFinding extends FindingBase {
  kind: 'dependency_cycle'
  evidence: { items: ItemRef[] }
}

export interface CriticalPathFinding extends FindingBase {
  kind: 'critical_path'
  evidence: {
    // Dependency chain, in order, ending at the item that finishes last.
    // `gapBeforeDays` is calendar days between the previous link's end and this
    // link's start (negative = they overlap); `idleWorkingDaysBefore` counts
    // only the working days of that gap. Both are null for the first link.
    chain: Array<ItemRef & {
      startDay: number
      endDay: number
      startDate: string
      endDate: string
      status: ItemStatus
      gapBeforeDays: number | null
      idleWorkingDaysBefore: number | null
    }>
    startDate: string
    endDate: string
    spanDays: number
    // Working days nobody is scheduled to work on the chain, waiting between links.
    idleWorkingDays: number
    atRiskCount: number
    overdueCount: number
    projectIds: string[]
  }
}

export interface IdleCapacityFinding extends FindingBase {
  kind: 'idle_capacity'
  // A run of working days with no work between two pieces of a person's work.
  evidence: {
    resourceId: string
    resourceName: string
    role: string | null
    startDay: number
    endDay: number
    startDate: string
    endDate: string
    idleWorkingDays: number
    // Cost of the unused capacity in the settings' currency; null when the person has no rate.
    idleCost: number | null
    currencySymbol: string
    beforeItem: ItemRef
    afterItem: ItemRef
    // Overloaded people whose overload overlaps this free window: candidates to hand work over.
    relief: Array<{ resourceId: string; resourceName: string; sameRole: boolean; overlapWorkingDays: number; overloadFindingId: string }>
  }
}

export interface UnassignedResourcesFinding extends FindingBase {
  kind: 'unassigned_resources'
  // People with no unfinished work at all in the rest of the plan, grouped in one finding.
  evidence: {
    startDate: string
    endDate: string
    workingDays: number
    people: Array<{ resourceId: string; resourceName: string; role: string | null; idleCost: number | null }>
    totalIdleCost: number | null
    currencySymbol: string
    // Overloaded people during that window: work that these people could take.
    overloadedDuring: Array<{ resourceId: string; resourceName: string; overlapWorkingDays: number; overloadFindingId: string }>
  }
}

export interface SprintSpilloverFinding extends FindingBase {
  kind: 'sprint_spillover'
  evidence: {
    sprintId: string
    sprintName: string
    sprintStartDate: string
    sprintEndDate: string
    // Tasks that would fit in one sprint but start in this one and end in the next.
    items: Array<ItemRef & { startDate: string; endDate: string; spillDays: number }>
  }
}

export interface OversizedItemsFinding extends FindingBase {
  kind: 'oversized_items'
  evidence: {
    // Tasks longer than the sprint they start in, so they can never fit in one.
    items: Array<ItemRef & { dur: number; sprintName: string; sprintDur: number }>
  }
}

export type Finding =
  | OverloadFinding | DependencyConflictFinding | DependencyCycleFinding | CriticalPathFinding
  | IdleCapacityFinding | UnassignedResourcesFinding | SprintSpilloverFinding | OversizedItemsFinding

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 }
const KIND_ORDER: Record<FindingKind, number> = {
  dependency_cycle: 0, dependency_conflict: 1, overload: 2, critical_path: 3, idle_capacity: 4, unassigned_resources: 5, sprint_spillover: 6, oversized_items: 7,
}

export function rankFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) =>
    SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
    KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
    b.score - a.score ||
    a.id.localeCompare(b.id))
}
