'use client'

import { useMemo } from 'react'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import { useTodayDay } from '@/lib/useTodayDay'
import { planEnd } from '@/lib/roadmapUtils'

// Last day the views show: the chosen end date, or `planEnd` when none is set.
// An explicit end date is used as is, even past the planned work.
export function usePlanEnd(): number {
  const items = useRoadmapStore(s => s.items)
  const sprints = useRoadmapStore(s => s.sprints)
  const filterStartDay = useRoadmapStore(s => s.filterStartDay)
  const filterEndDay = useRoadmapStore(s => s.filterEndDay)
  const todayDay = useTodayDay()
  const auto = useMemo(() => planEnd(items, sprints, todayDay, filterStartDay), [items, sprints, todayDay, filterStartDay])
  return filterEndDay ?? auto
}
