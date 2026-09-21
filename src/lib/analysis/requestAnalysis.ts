'use client'

import type { AnalyzeResponse } from '@engine/index'
import { getTodayDay } from '@/data/initialData'
import { getLocale } from '@/lib/i18n/localeStore'
import { dateStr } from '@/lib/roadmapUtils'
import { useRoadmapStore } from '@/store/useRoadmapStore'

// Analyzes the roadmap as it is on screen (including unsaved edits). Without
// `narrate` the reply is instant; with it the server also asks the LLM for a
// prioritized summary, which can take several seconds.
export async function requestAnalysis(narrate: boolean, signal?: AbortSignal): Promise<AnalyzeResponse> {
  const { projects, items, resources, deps, sprints, settings } = useRoadmapStore.getState()
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      snapshot: { projects, items, resources, deps, sprints, settings },
      originDate: dateStr(0),
      todayDay: getTodayDay(),
      locale: getLocale(),
      narrate,
    }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`)
  return data as AnalyzeResponse
}
