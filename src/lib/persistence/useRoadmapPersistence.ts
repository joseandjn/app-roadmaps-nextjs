'use client'

import { useEffect, useRef } from 'react'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import type { ScenarioMeta, Filters, PersistedFilters, SavedView } from '@/types'
import { viewPayload } from './viewPayload'
import { loadScenario, scheduleSave, isApplyingScenario, startScenarioSync } from './scenarioSync'
import { MOMENTARY_FILTER_KEYS } from '@/lib/filters'

const SAVE_DEBOUNCE_MS = 600

// Whether a saved part of the filters changed. The text search, dependency
// path and finding highlight aren't saved, so typing a search doesn't
// rewrite view.json.
function persistedFiltersChanged(a: Filters, b: Filters): boolean {
  if (a === b) return false
  return (Object.keys(a) as (keyof Filters)[]).some(k => !(MOMENTARY_FILTER_KEYS as readonly string[]).includes(k) && a[k] !== b[k])
}

export function useRoadmapPersistence() {
  const hydrateView = useRoadmapStore(s => s.hydrateView)
  const setScenarioList = useRoadmapStore(s => s.setScenarioList)
  const setActiveScenarioId = useRoadmapStore(s => s.setActiveScenarioId)
  const hydrated = useRef(false)
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

        if (cancelled || !(await loadScenario(view.activeScenarioId)) || cancelled) return
        hydrateView(view)
      } catch {
        // offline/unreachable — keep whatever's in the store (seed data)
      } finally {
        if (!cancelled) hydrated.current = true
      }
    })()
    return () => { cancelled = true }
  }, [hydrateView, setScenarioList, setActiveScenarioId])

  useEffect(() => {
    const saveView = () => {
      const { activeScenarioId } = useRoadmapStore.getState()
      if (!activeScenarioId) return
      fetch('/api/view', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(viewPayload(activeScenarioId)),
      }).catch(() => {})
    }

    const stopSync = startScenarioSync()
    const unsubscribe = useRoadmapStore.subscribe((state, prevState) => {
      // A load replacing the data (another tab's save, a scenario switch)
      // isn't an edit: saving it back would only echo it.
      if (!hydrated.current || isApplyingScenario()) return

      if (
        state.projects !== prevState.projects ||
        state.items !== prevState.items ||
        state.resources !== prevState.resources ||
        state.deps !== prevState.deps ||
        state.sprints !== prevState.sprints ||
        state.settings !== prevState.settings ||
        state.roles !== prevState.roles
      ) {
        scheduleSave()
      }

      if (
        state.filterStartDay !== prevState.filterStartDay || state.filterEndDay !== prevState.filterEndDay ||
        persistedFiltersChanged(state.filters, prevState.filters) || state.visible !== prevState.visible ||
        state.savedViews !== prevState.savedViews
      ) {
        if (viewSaveTimer.current) clearTimeout(viewSaveTimer.current)
        viewSaveTimer.current = setTimeout(saveView, SAVE_DEBOUNCE_MS)
      }
    })
    return () => { unsubscribe(); stopSync() }
  }, [])
}
