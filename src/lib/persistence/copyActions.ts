'use client'

import type { ScenarioData } from '@/types'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import { applyCopy, buildCopyPayload, type CopyPayload, type CopySummary } from '@/lib/scenarioCopy'
import { announceScenarioRevision } from './scenarioSync'

// The selected items of the active scenario, as they are in the editor.
function selectionPayload(): CopyPayload {
  const { projects, items, resources, deps, sprints, settings, roles, selectedIds } = useRoadmapStore.getState()
  return buildCopyPayload({ projects, items, resources, deps, sprints, settings, roles }, selectedIds)
}

// What copying the selection into `targetId` would do, from its saved data.
export async function previewCopy(targetId: string, signal?: AbortSignal): Promise<CopySummary> {
  const res = await fetch(`/api/scenarios/${targetId}`, { signal })
  if (!res.ok) throw new Error(`Could not read that scenario (${res.status})`)
  return applyCopy(await res.json() as ScenarioData, selectionPayload()).summary
}

// Copies the selection into `targetId` (the server saves a checkpoint of it
// first) and tells a tab showing that scenario to reload.
export async function copySelectionTo(targetId: string, checkpointName: string): Promise<CopySummary> {
  const res = await fetch(`/api/scenarios/${targetId}/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload: selectionPayload(), checkpointName }),
  })
  const data = await res.json().catch(() => null) as { summary?: CopySummary; rev?: string; error?: string } | null
  if (!res.ok || !data?.summary) throw new Error(data?.error ?? `Copy failed (${res.status})`)
  if (data.rev) announceScenarioRevision(targetId, data.rev)
  return data.summary
}
