'use client'

import { useRoadmapStore } from '@/store/useRoadmapStore'
import type { ScenarioData, ScenarioMeta, CheckpointMeta, Checkpoint } from '@/types'
import { viewPayload } from './viewPayload'

function saveView(activeScenarioId: string) {
  fetch('/api/view', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(viewPayload(activeScenarioId)),
  }).catch(() => {})
}

export async function refreshScenarioList(): Promise<void> {
  const res = await fetch('/api/scenarios')
  if (!res.ok) return
  const { scenarios, officialId } = await res.json() as { scenarios: ScenarioMeta[]; officialId: string }
  useRoadmapStore.getState().setScenarioList(scenarios, officialId)
}

export async function switchScenario(id: string): Promise<void> {
  const res = await fetch(`/api/scenarios/${id}`)
  if (!res.ok) return
  const data = await res.json() as ScenarioData
  useRoadmapStore.getState().hydrateScenario(data)
  useRoadmapStore.getState().setActiveScenarioId(id)
  saveView(id)
}

export async function createScenarioAndSwitch(name: string, note: string): Promise<void> {
  const basedOn = useRoadmapStore.getState().activeScenarioId
  if (!basedOn) return
  const res = await fetch('/api/scenarios', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, note, basedOn }),
  })
  if (!res.ok) return
  const meta = await res.json() as ScenarioMeta
  await refreshScenarioList()
  await switchScenario(meta.id)
}

export async function promoteScenario(id: string): Promise<void> {
  const res = await fetch(`/api/scenarios/${id}/promote`, { method: 'POST' })
  if (!res.ok) return
  await refreshScenarioList()
}

export async function fetchCheckpoints(scenarioId: string): Promise<CheckpointMeta[]> {
  const res = await fetch(`/api/scenarios/${scenarioId}/checkpoints`)
  if (!res.ok) return []
  return res.json() as Promise<CheckpointMeta[]>
}

export async function fetchCheckpoint(scenarioId: string, checkpointId: string): Promise<Checkpoint | null> {
  const res = await fetch(`/api/scenarios/${scenarioId}/checkpoints/${checkpointId}`)
  return res.ok ? res.json() as Promise<Checkpoint> : null
}

// Saves a checkpoint of whatever's currently persisted for this scenario.
// Flush any pending debounced edit first so the checkpoint reflects the
// latest changes rather than a stale save.
export async function saveCheckpoint(scenarioId: string, name: string, note: string): Promise<CheckpointMeta | null> {
  const { projects, items, resources, deps, sprints, settings, roles } = useRoadmapStore.getState()
  await fetch(`/api/scenarios/${scenarioId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projects, items, resources, deps, sprints, settings, roles }),
  }).catch(() => {})

  const res = await fetch(`/api/scenarios/${scenarioId}/checkpoints`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, note }),
  })
  return res.ok ? res.json() as Promise<CheckpointMeta> : null
}

export async function deleteCheckpointAction(scenarioId: string, checkpointId: string): Promise<void> {
  await fetch(`/api/scenarios/${scenarioId}/checkpoints/${checkpointId}`, { method: 'DELETE' }).catch(() => {})
}

// Overwrites the scenario's saved data with a past checkpoint, then reloads
// it into the store so the editor reflects the rollback immediately.
export async function restoreCheckpointAction(scenarioId: string, checkpointId: string): Promise<boolean> {
  const res = await fetch(`/api/scenarios/${scenarioId}/checkpoints/${checkpointId}/restore`, { method: 'POST' })
  if (!res.ok) return false
  if (useRoadmapStore.getState().activeScenarioId === scenarioId) await switchScenario(scenarioId)
  return true
}
