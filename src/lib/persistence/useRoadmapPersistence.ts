'use client'

import { useEffect, useRef } from 'react'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import type { ScenarioData, ScenarioMeta } from '@/types'

const SAVE_DEBOUNCE_MS = 600

export function useRoadmapPersistence() {
  const hydrateScenario = useRoadmapStore(s => s.hydrateScenario)
  const hydrateView = useRoadmapStore(s => s.hydrateView)
  const setScenarioList = useRoadmapStore(s => s.setScenarioList)
  const setActiveScenarioId = useRoadmapStore(s => s.setActiveScenarioId)
  const hydrated = useRef(false)
  const scenarioSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const viewSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Boot sequence: view state (which scenario + filter) → scenario list →
  // that scenario's data. All three run before `hydrated` flips true, so
  // none of these hydration writes trigger a save (see the subscribe below).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const viewRes = await fetch('/api/view')
        if (cancelled || !viewRes.ok) return
        const view = await viewRes.json() as { filterStartDay: number | null; filterEndDay: number | null; activeScenarioId: string }
        hydrateView(view)
        setActiveScenarioId(view.activeScenarioId)

        const listRes = await fetch('/api/scenarios')
        if (cancelled || !listRes.ok) return
        const { scenarios, officialId } = await listRes.json() as { scenarios: ScenarioMeta[]; officialId: string }
        setScenarioList(scenarios, officialId)

        const scenarioRes = await fetch(`/api/scenarios/${view.activeScenarioId}`)
        if (cancelled || !scenarioRes.ok) return
        const data = await scenarioRes.json() as ScenarioData
        hydrateScenario(data)
      } catch {
        // offline/unreachable — keep whatever's in the store (seed data)
      } finally {
        if (!cancelled) hydrated.current = true
      }
    })()
    return () => { cancelled = true }
  }, [hydrateScenario, hydrateView, setScenarioList, setActiveScenarioId])

  useEffect(() => {
    const saveScenario = () => {
      const { activeScenarioId, projects, items, resources, deps, sprints, settings } = useRoadmapStore.getState()
      if (!activeScenarioId) return
      fetch(`/api/scenarios/${activeScenarioId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projects, items, resources, deps, sprints, settings }),
      }).catch(() => {})
    }
    const saveView = () => {
      const { activeScenarioId, filterStartDay, filterEndDay } = useRoadmapStore.getState()
      if (!activeScenarioId) return
      fetch('/api/view', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filterStartDay, filterEndDay, activeScenarioId }),
      }).catch(() => {})
    }

    return useRoadmapStore.subscribe((state, prevState) => {
      if (!hydrated.current) return

      if (
        state.projects !== prevState.projects ||
        state.items !== prevState.items ||
        state.resources !== prevState.resources ||
        state.deps !== prevState.deps ||
        state.sprints !== prevState.sprints ||
        state.settings !== prevState.settings
      ) {
        if (scenarioSaveTimer.current) clearTimeout(scenarioSaveTimer.current)
        scenarioSaveTimer.current = setTimeout(saveScenario, SAVE_DEBOUNCE_MS)
      }

      if (state.filterStartDay !== prevState.filterStartDay || state.filterEndDay !== prevState.filterEndDay) {
        if (viewSaveTimer.current) clearTimeout(viewSaveTimer.current)
        viewSaveTimer.current = setTimeout(saveView, SAVE_DEBOUNCE_MS)
      }
    })
  }, [])
}
