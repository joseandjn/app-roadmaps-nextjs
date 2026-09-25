import { assignmentCostsInRange, computeScenarioMetrics, itemEnd, resourceCapacity, sameTimeOff } from '@/lib/roadmapUtils'
import type { Item, Resource, ScenarioData, ScenarioMetrics } from '@/types'

export interface AssignmentChange {
  rid: string
  from: number | null // allocation % before, null = wasn't assigned
  to: number | null // allocation % after, null = no longer assigned
}

export interface ItemDiff {
  id: string
  kind: 'added' | 'removed' | 'changed'
  before: Item | null
  after: Item | null
  startShift: number
  endShift: number
  fields: ('title' | 'status' | 'type' | 'project')[]
  assignments: AssignmentChange[]
  costBefore: number
  costAfter: number
}

export interface ResourceDiff {
  id: string
  kind: 'added' | 'removed' | 'changed'
  before: Resource | null
  after: Resource | null
  costBefore: number // this person's allocated cost across the whole timeline
  costAfter: number
}

export interface ScenarioDiff {
  before: ScenarioMetrics
  after: ScenarioMetrics
  items: ItemDiff[]
  resources: ResourceDiff[]
}

const EPS = 0.005

function costsOf(data: ScenarioData) {
  const byItem: Record<string, number> = {}
  const byResource: Record<string, number> = {}
  for (const it of data.items) {
    for (const { rid, cost } of assignmentCostsInRange(it, data.resources, -Infinity, Infinity, data.settings)) {
      byItem[it.id] = (byItem[it.id] ?? 0) + cost
      byResource[rid] = (byResource[rid] ?? 0) + cost
    }
  }
  return { byItem, byResource }
}

function diffAssignments(before: Item, after: Item): AssignmentChange[] {
  const b = new Map(before.assignments.map(a => [a.r, a.pct]))
  const a = new Map(after.assignments.map(x => [x.r, x.pct]))
  const out: AssignmentChange[] = []
  for (const [rid, pct] of b) {
    if (!a.has(rid)) out.push({ rid, from: pct, to: null })
    else if (a.get(rid) !== pct) out.push({ rid, from: pct, to: a.get(rid)! })
  }
  for (const [rid, pct] of a) if (!b.has(rid)) out.push({ rid, from: null, to: pct })
  return out
}

// Items and people are matched by id — scenarios are created by duplicating
// another one, so unchanged things keep the same ids on both sides.
export function diffScenarios(base: ScenarioData, target: ScenarioData): ScenarioDiff {
  const baseCosts = costsOf(base)
  const targetCosts = costsOf(target)

  const baseItems = new Map(base.items.map(i => [i.id, i]))
  const targetItems = new Map(target.items.map(i => [i.id, i]))
  const items: ItemDiff[] = []

  for (const [id, before] of baseItems) {
    const costBefore = baseCosts.byItem[id] ?? 0
    const after = targetItems.get(id)
    if (!after) {
      items.push({ id, kind: 'removed', before, after: null, startShift: 0, endShift: 0, fields: [], assignments: [], costBefore, costAfter: 0 })
      continue
    }
    const costAfter = targetCosts.byItem[id] ?? 0
    const fields: ItemDiff['fields'] = []
    if (before.title !== after.title) fields.push('title')
    if (before.status !== after.status) fields.push('status')
    if (before.type !== after.type) fields.push('type')
    if (before.projectId !== after.projectId) fields.push('project')
    const assignments = diffAssignments(before, after)
    const startShift = after.startDay - before.startDay
    const endShift = itemEnd(after) - itemEnd(before)
    if (startShift || endShift || fields.length || assignments.length || Math.abs(costAfter - costBefore) > EPS) {
      items.push({ id, kind: 'changed', before, after, startShift, endShift, fields, assignments, costBefore, costAfter })
    }
  }
  for (const [id, after] of targetItems) {
    if (baseItems.has(id)) continue
    items.push({ id, kind: 'added', before: null, after, startShift: 0, endShift: 0, fields: [], assignments: [], costBefore: 0, costAfter: targetCosts.byItem[id] ?? 0 })
  }
  items.sort((a, b) => Math.abs(b.costAfter - b.costBefore) - Math.abs(a.costAfter - a.costBefore))

  const baseRes = new Map(base.resources.map(r => [r.id, r]))
  const targetRes = new Map(target.resources.map(r => [r.id, r]))
  const resources: ResourceDiff[] = []
  for (const [id, before] of baseRes) {
    const after = targetRes.get(id)
    const costBefore = baseCosts.byResource[id] ?? 0
    if (!after) {
      resources.push({ id, kind: 'removed', before, after: null, costBefore, costAfter: 0 })
    } else if (before.name !== after.name || before.role !== after.role || before.cost !== after.cost || before.costUnit !== after.costUnit || resourceCapacity(before) !== resourceCapacity(after) || !sameTimeOff(before.timeOff, after.timeOff)) {
      resources.push({ id, kind: 'changed', before, after, costBefore, costAfter: targetCosts.byResource[id] ?? 0 })
    }
  }
  for (const [id, after] of targetRes) {
    if (!baseRes.has(id)) resources.push({ id, kind: 'added', before: null, after, costBefore: 0, costAfter: targetCosts.byResource[id] ?? 0 })
  }
  resources.sort((a, b) => Math.abs(b.costAfter - b.costBefore) - Math.abs(a.costAfter - a.costBefore))

  return { before: computeScenarioMetrics(base), after: computeScenarioMetrics(target), items, resources }
}
