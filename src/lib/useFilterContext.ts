'use client'

import { useMemo } from 'react'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import { itemIssues, dependencyChain, type FilterContext } from '@/lib/filters'

// Everything itemMatch/itemsForMetrics need, memoized so issues are only
// recomputed when the planning data changes, not on every filter tweak.
export function useFilterContext(): FilterContext {
  const filters = useRoadmapStore(s => s.filters)
  const visible = useRoadmapStore(s => s.visible)
  const resources = useRoadmapStore(s => s.resources)
  const items = useRoadmapStore(s => s.items)
  const deps = useRoadmapStore(s => s.deps)
  const projects = useRoadmapStore(s => s.projects)
  const issues = useMemo(() => itemIssues(items, deps, resources), [items, deps, resources])
  const focus = filters.focusItemId
  const chain = useMemo(() => focus ? dependencyChain(focus, deps) : null, [focus, deps])
  return useMemo(() => ({ filters, visible, resources, issues, chain, projects }), [filters, visible, resources, issues, chain, projects])
}
