'use client'

import type { ScenarioData, ScenarioMeta } from '@/types'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import { buildBackup, backupFileName, type BackupFile } from '@/lib/backup'
import { flushSave } from './scenarioSync'
import { refreshScenarioList } from './scenarioActions'

// Downloads the given scenarios as one backup file, with their saved data
// (the open one is saved first, so the file has the latest edits).
export async function exportScenarios(ids: string[]): Promise<string> {
  const { scenarios, activeScenarioId } = useRoadmapStore.getState()
  if (activeScenarioId && ids.includes(activeScenarioId)) await flushSave()
  const entries = []
  for (const id of ids) {
    const meta = scenarios.find(s => s.id === id)
    const res = await fetch(`/api/scenarios/${id}`, { cache: 'no-store' })
    if (!meta || !res.ok) throw new Error(`Could not read "${meta?.name ?? id}" (${res.status})`)
    entries.push({ name: meta.name, note: meta.note, data: await res.json() as ScenarioData })
  }
  const backup = buildBackup(entries)
  const name = backupFileName(backup)
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return name
}

// Creates one new scenario per entry of the backup (never overwrites one).
export async function importBackup(backup: BackupFile, suffix: string): Promise<ScenarioMeta[]> {
  const created: ScenarioMeta[] = []
  for (const s of backup.scenarios) {
    const res = await fetch('/api/scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `${s.name} ${suffix}`.trim(), note: s.note, data: s.data }),
    })
    const body = await res.json().catch(() => null) as ScenarioMeta & { error?: string } | null
    if (!res.ok || !body) throw new Error(body?.error ?? `Import failed (${res.status})`)
    created.push(body)
  }
  await refreshScenarioList()
  return created
}
