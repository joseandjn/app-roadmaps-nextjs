'use client'

import { useRoadmapStore } from '@/store/useRoadmapStore'
import type { PersistedFilters } from '@/types'

// The body PUT to /api/view: date range, active scenario, the filters worth
// keeping across reloads, and which projects are hidden.
export function viewPayload(activeScenarioId: string) {
  const { filterStartDay, filterEndDay, filters, projects, visible } = useRoadmapStore.getState()
  const persisted: PersistedFilters = {
    resourceIds: filters.resourceIds,
    roles: filters.roles,
    statuses: filters.statuses,
    types: filters.types,
    onlyIssues: filters.onlyIssues,
    unassigned: filters.unassigned,
    uncovered: filters.uncovered,
  }
  return {
    filterStartDay, filterEndDay, activeScenarioId,
    filters: persisted,
    hiddenProjectIds: projects.filter(p => !visible.has(p.id)).map(p => p.id),
  }
}
