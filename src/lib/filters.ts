import type { Dependency, Filters, Item, Project, Resource, Role } from '@/types'
import { isOverloaded, dependencyIssues, overloadedItemIds, roleMismatch } from '@/lib/roadmapUtils'

// Single source of truth for what the view filters mean. Views never
// re-implement these rules — they ask `itemMatch` per item, or use
// `itemsForMetrics` for anything that sums load or cost.
// See docs/filters-backlog.md for the full plan (F2+ add dimensions here).

export const EMPTY_FILTERS: Filters = {
  resourceIds: [],
  roles: [],
  statuses: [],
  types: [],
  onlyIssues: false,
  unassigned: false,
  uncovered: false,
  focusItemId: null,
  text: '',
}

export interface FilterContext {
  filters: Filters
  visible: Set<string>
  resources: Resource[] // to match roles through who's assigned
  issues: Map<string, IssueKind[]> // from itemIssues, for "only issues"
}

// Why an item needs attention. Cheap, live signals only — the Analysis
// engine (engine/analyzers) has richer rules (critical path, idle capacity,
// sprint spillover) and stays the place for those.
export type IssueKind = 'dependency' | 'overload' | 'role' | 'risk'

export function itemIssues(items: Item[], deps: Dependency[], resources: Resource[]): Map<string, IssueKind[]> {
  const { conflicted } = dependencyIssues(items, deps)
  const overloaded = overloadedItemIds(items, resources)
  const out = new Map<string, IssueKind[]>()
  for (const it of items) {
    const kinds: IssueKind[] = []
    if (conflicted.has(it.id)) kinds.push('dependency')
    if (overloaded.has(it.id)) kinds.push('overload')
    if (it.assignments.some(a => { const r = resources.find(rr => rr.id === a.r); return !!r && roleMismatch(it, r) })) kinds.push('role')
    if (it.status === 'At Risk') kinds.push('risk')
    if (kinds.length) out.set(it.id, kinds)
  }
  return out
}

// 'dim' keeps the item on screen (and in load/cost) but de-emphasized, so
// person/role filters don't lose dependency context; 'hide' removes it.
export type ItemMatch = 'show' | 'dim' | 'hide'
export const DIM_OPACITY = 0.25

export function itemMatch(item: Item, ctx: FilterContext): ItemMatch {
  const f = ctx.filters
  if (!ctx.visible.has(item.projectId)) return 'hide'
  if (f.statuses.length && !f.statuses.includes(item.status)) return 'hide'
  if (f.types.length && !f.types.includes(item.type)) return 'hide'
  if (f.onlyIssues && !ctx.issues.has(item.id)) return 'hide'
  // The two gap filters are alternatives: an item passes if it has either gap picked.
  if ((f.unassigned || f.uncovered) && !((f.unassigned && isUnassigned(item)) || (f.uncovered && isRoleUncovered(item, ctx.resources)))) return 'hide'
  if (f.resourceIds.length && !item.assignments.some(a => f.resourceIds.includes(a.r))) return 'dim'
  if (f.roles.length && !itemHasRole(item, f.roles, ctx.resources)) return 'dim'
  return 'show'
}

// An item "is" a role either because it requires it or because someone with
// that role works on it. Items open to any role only match the second way.
function itemHasRole(item: Item, roles: string[], resources: Resource[]): boolean {
  if (item.requiredRoles?.some(r => roles.includes(r))) return true
  return item.assignments.some(a => {
    const role = resources.find(r => r.id === a.r)?.role
    return !!role && roles.includes(role)
  })
}

// A span of work (not a milestone/release) with nobody on it.
export function isUnassigned(item: Item): boolean {
  return (item.type === 'epic' || item.type === 'task') && item.dur > 0 && item.assignments.length === 0
}

// The item needs specific roles and nobody assigned has any of them
// (including when nobody is assigned at all).
export function isRoleUncovered(item: Item, resources: Resource[]): boolean {
  if (!item.requiredRoles?.length) return false
  return !item.assignments.some(a => {
    const role = resources.find(r => r.id === a.r)?.role
    return !!role && item.requiredRoles!.includes(role)
  })
}

// Whether a person passes the people and role filters — Resources shows only
// these rows, and Costs only counts their assignments.
export function resourceMatches(r: Resource, f: Filters): boolean {
  if (f.resourceIds.length && !f.resourceIds.includes(r.id)) return false
  if (f.roles.length && !f.roles.includes(r.role)) return false
  return true
}

// Whether any filter hides individual items (beyond hiding whole projects).
// Timeline/Cross drop lanes left empty by these, instead of showing a
// visible-but-blank project.
export function hidesItems(f: Filters): boolean {
  return f.statuses.length > 0 || f.types.length > 0 || f.onlyIssues || f.unassigned || f.uncovered
}

// Items that count toward load and cost: everything not hidden (dimmed
// items still count — dimming is purely visual).
export function itemsForMetrics(items: Item[], ctx: FilterContext): Item[] {
  return items.filter(it => itemMatch(it, ctx) !== 'hide')
}

// Load/cost views show the filtered load (what this slice of the plan asks of
// a person), but color by the full load when that one is over capacity — a
// filter must never hide a real overload.
export function colorLoad(filtered: number, full: number, r: Pick<Resource, 'availability'>): number {
  return isOverloaded(full, r) ? full : filtered
}

// How many filters are on, for the "filtered" badge. The date range counts
// as one, and so does hiding any number of projects.
export function activeFilterCount(s: {
  filters: Filters
  visible: Set<string>
  projects: Project[]
  filterStartDay: number | null
  filterEndDay: number | null
}): number {
  const f = s.filters
  let n = 0
  if (s.filterStartDay !== null || s.filterEndDay !== null) n++
  if (s.projects.some(p => !s.visible.has(p.id))) n++
  if (f.resourceIds.length) n++
  if (f.roles.length) n++
  if (f.statuses.length) n++
  if (f.types.length) n++
  if (f.onlyIssues) n++
  if (f.unassigned || f.uncovered) n++
  if (f.focusItemId) n++
  if (f.text.trim()) n++
  return n
}

// Drops references to people, roles or items that no longer exist (deleted,
// undone, or a different scenario loaded). Returns the same object when
// nothing changed, so callers can skip the update.
export function pruneFilters(f: Filters, data: { items: Item[]; resources: Resource[]; roles: Role[] }): Filters {
  const resourceIds = f.resourceIds.filter(id => data.resources.some(r => r.id === id))
  const roles = f.roles.filter(name => data.roles.some(r => r.name === name))
  const focusItemId = f.focusItemId && data.items.some(i => i.id === f.focusItemId) ? f.focusItemId : null
  if (resourceIds.length === f.resourceIds.length && roles.length === f.roles.length && focusItemId === f.focusItemId) return f
  return { ...f, resourceIds, roles, focusItemId }
}
