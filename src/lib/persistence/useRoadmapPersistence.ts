'use client'

import { useEffect, useRef } from 'react'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import type { ScenarioData, ScenarioMeta, PersistedFilters, SavedView } from '@/types'
import { viewPayload } from './viewPayload'

const SAVE_DEBOUNCE_MS = 600

export function useRoadmapPersistence() {
  const hydrateScenario = useRoadmapStore(s => s.hydrateScenario)
  const hydrateView = useRoadmapStore(s => s.hydrateView)
  const setScenarioList = useRoadmapStore(s => s.setScenarioList)
  const setActiveScenarioId = useRoadmapStore(s => s.setActiveScenarioId)
  const hydrated = useRef(false)
  const scenarioSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const viewSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Boot sequence: view state (which scenario) → scenario list → that
  // scenario's data → the rest of the view (date range, filters, hidden
  // projects), which needs the data to drop ids that no longer exist. All of
  // it runs before `hydrated` flips true, so none of these writes trigger a
  // save (see the subscribe below).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const viewRes = await fetch('/api/view')
        if (cancelled || !viewRes.ok) return
        const view = await viewRes.json() as { filterStartDay: number | null; filterEndDay: number | null; activeScenarioId: string; filters?: PersistedFilters; hiddenProjectIds?: string[]; savedViews?: SavedView[] }
        setActiveScenarioId(view.activeScenarioId)

        const listRes = await fetch('/api/scenarios')
        if (cancelled || !listRes.ok) return
        const { scenarios, officialId } = await listRes.json() as { scenarios: ScenarioMeta[]; officialId: string }
        setScenarioList(scenarios, officialId)

        const scenarioRes = await fetch(`/api/scenarios/${view.activeScenarioId}`)
        if (cancelled || !scenarioRes.ok) return
        const data = await scenarioRes.json() as ScenarioData
        hydrateScenario(data)
        hydrateView(view)
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
      const { activeScenarioId, projects, items, resources, deps, sprints, settings, roles } = useRoadmapStore.getState()
      if (!activeScenarioId) return
      fetch(`/api/scenarios/${activeScenarioId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projects, items, resources, deps, sprints, settings, roles }),
      }).catch(() => {})
    }
    const saveView = () => {
      const { activeScenarioId } = useRoadmapStore.getState()
      if (!activeScenarioId) return
      fetch('/api/view', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(viewPayload(activeScenarioId)),
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
        state.settings !== prevState.settings ||
        state.roles !== prevState.roles
      ) {
        if (scenarioSaveTimer.current) clearTimeout(scenarioSaveTimer.current)
        scenarioSaveTimer.current = setTimeout(saveScenario, SAVE_DEBOUNCE_MS)
      }

      if (
        state.filterStartDay !== prevState.filterStartDay || state.filterEndDay !== prevState.filterEndDay ||
        state.filters !== prevState.filters || state.visible !== prevState.visible ||
        state.savedViews !== prevState.savedViews
      ) {
        if (viewSaveTimer.current) clearTimeout(viewSaveTimer.current)
        viewSaveTimer.current = setTimeout(saveView, SAVE_DEBOUNCE_MS)
      }
    })
  }, [])
}
