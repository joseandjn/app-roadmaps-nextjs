'use client'

import { useRoadmapStore } from '@/store/useRoadmapStore'
import { currentViewSnapshot } from '@/lib/filters'

// The body PUT to /api/view: active scenario, the current view (date range,
// filters worth keeping, hidden projects) and the user's saved views.
export function viewPayload(activeScenarioId: string) {
  const s = useRoadmapStore.getState()
  return { activeScenarioId, ...currentViewSnapshot(s), savedViews: s.savedViews }
}
