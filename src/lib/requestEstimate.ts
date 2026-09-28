'use client'

import type { Draft } from '@/types'
import type { EstimateSuggestion } from '@/lib/estimator'
import { getLocale } from '@/lib/i18n/localeStore'
import { useRoadmapStore } from '@/store/useRoadmapStore'

export class EstimateRequestError extends Error {
  constructor(public code: string, message: string) { super(message) }
}

// Asks /api/estimate for a duration for the item being edited, as it is in
// the editor (unsaved title, description, roles and dependencies included).
export async function requestEstimate(draft: Draft, signal?: AbortSignal): Promise<EstimateSuggestion> {
  const { projects, items } = useRoadmapStore.getState()
  const project = projects.find(p => p.id === draft.projectId)
  const res = await fetch('/api/estimate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      id: draft._new ? undefined : draft.id,
      title: draft.title,
      description: draft.description,
      type: draft.type,
      requiredRoles: draft.requiredRoles ?? [],
      project: project ? { name: project.name, category: project.category } : undefined,
      dependencies: draft._deps.flatMap(id => {
        const it = items.find(i => i.id === id)
        return it ? [{ title: it.title, status: it.status }] : []
      }),
      locale: getLocale(),
    }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new EstimateRequestError(data?.code ?? 'failed', data?.error ?? `Request failed (${res.status})`)
  return data as EstimateSuggestion
}
