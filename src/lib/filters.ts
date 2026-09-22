import type { Filters, Item, Project, Resource, Role } from '@/types'

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
  focusItemId: null,
  text: '',
}

export interface FilterContext {
  filters: Filters
  visible: Set<string>
}

// 'dim' keeps the item on screen (and in load/cost) but de-emphasized, so
// person/role filters don't lose dependency context; 'hide' removes it.
export type ItemMatch = 'show' | 'dim' | 'hide'

export function itemMatch(item: Item, ctx: FilterContext): ItemMatch {
  if (!ctx.visible.has(item.projectId)) return 'hide'
  return 'show'
}

// Items that count toward load and cost: everything not hidden (dimmed
// items still count — dimming is purely visual).
export function itemsForMetrics(items: Item[], ctx: FilterContext): Item[] {
  return items.filter(it => itemMatch(it, ctx) !== 'hide')
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
  if (f.unassigned) n++
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
