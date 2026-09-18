import { promises as fs } from 'fs'
import path from 'path'
import { computeScenarioMetrics } from '@/lib/roadmapUtils'
import { readScenario, writeScenario } from './scenarioFile'
import type { Checkpoint, CheckpointMeta } from '@/types'

const SCENARIOS_DIR = path.join(process.cwd(), 'storage', 'scenarios')

function checkpointsFile(scenarioId: string): string {
  return path.join(SCENARIOS_DIR, `${scenarioId}.checkpoints.json`)
}

async function readAll(scenarioId: string): Promise<Checkpoint[]> {
  try {
    const raw = await fs.readFile(checkpointsFile(scenarioId), 'utf-8')
    return JSON.parse(raw) as Checkpoint[]
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }
}

async function writeAll(scenarioId: string, checkpoints: Checkpoint[]): Promise<void> {
  const file = checkpointsFile(scenarioId)
  const tmp = `${file}.tmp`
  await fs.writeFile(tmp, JSON.stringify(checkpoints, null, 2), 'utf-8')
  await fs.rename(tmp, file)
}

// Metadata only (no snapshot) — cheap to list for the history panel.
export async function listCheckpoints(scenarioId: string): Promise<CheckpointMeta[]> {
  const all = await readAll(scenarioId)
  return all.map(({ snapshot: _snapshot, ...meta }) => meta)
}

export async function readCheckpoint(scenarioId: string, checkpointId: string): Promise<Checkpoint | null> {
  const all = await readAll(scenarioId)
  return all.find(c => c.id === checkpointId) ?? null
}

export async function createCheckpoint(scenarioId: string, opts: { name: string; note: string }): Promise<CheckpointMeta> {
  const data = await readScenario(scenarioId)
  if (!data) throw new Error('Unknown scenario')
  const checkpoint: Checkpoint = {
    id: 'c' + Date.now(),
    name: opts.name,
    note: opts.note,
    createdAt: new Date().toISOString(),
    metrics: computeScenarioMetrics(data),
    snapshot: data,
  }
  const all = await readAll(scenarioId)
  all.push(checkpoint)
  await writeAll(scenarioId, all)
  const { snapshot: _snapshot, ...meta } = checkpoint
  return meta
}

export async function deleteCheckpoint(scenarioId: string, checkpointId: string): Promise<void> {
  const all = await readAll(scenarioId)
  await writeAll(scenarioId, all.filter(c => c.id !== checkpointId))
}

// Overwrites the scenario's live/current data with a past checkpoint's
// snapshot — an explicit, in-place rollback (not a fork).
export async function restoreCheckpoint(scenarioId: string, checkpointId: string): Promise<void> {
  const checkpoint = await readCheckpoint(scenarioId, checkpointId)
  if (!checkpoint) throw new Error('Unknown checkpoint')
  await writeScenario(scenarioId, checkpoint.snapshot)
}
