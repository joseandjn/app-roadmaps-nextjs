import { promises as fs } from 'fs'
import path from 'path'
import { INITIAL_PROJECTS, INITIAL_ITEMS, INITIAL_RESOURCES, INITIAL_DEPS, INITIAL_SPRINTS, INITIAL_ROLES, DEFAULT_SETTINGS } from '@/data/initialData'
import { iconForRoleName } from '@/data/roleIcons'
import type { ScenarioData, ScenarioMeta } from '@/types'

const STORAGE_DIR = path.join(process.cwd(), 'storage')
const SCENARIOS_DIR = path.join(STORAGE_DIR, 'scenarios')
const INDEX_FILE = path.join(SCENARIOS_DIR, 'index.json')
const OLD_ROADMAP_FILE = path.join(STORAGE_DIR, 'roadmap.json')

interface ScenarioIndex {
  scenarios: ScenarioMeta[]
  officialId: string
}

function scenarioFile(id: string): string {
  return path.join(SCENARIOS_DIR, `${id}.json`)
}

function seedData(): ScenarioData {
  return { projects: INITIAL_PROJECTS, items: INITIAL_ITEMS, resources: INITIAL_RESOURCES, deps: INITIAL_DEPS, sprints: INITIAL_SPRINTS, settings: DEFAULT_SETTINGS, roles: INITIAL_ROLES }
}

// Backfills `roles` on data written before the roles catalog existed (or, defensively,
// any payload that omits it): the built-in catalog, plus any role name already in use
// by a resource or item that isn't in it yet, so nothing already assigned loses its
// label. Applied on every read/write rather than as a one-time migration, so it also
// self-heals a scenario restored from an old checkpoint.
function ensureRoles(data: ScenarioData): ScenarioData {
  if (Array.isArray(data.roles) && data.roles.length > 0) return data
  const known = new Set(INITIAL_ROLES.map(r => r.name))
  const extra = new Set<string>()
  for (const r of data.resources) if (r.role && !known.has(r.role)) extra.add(r.role)
  for (const it of data.items) if (it.requiredRole && !known.has(it.requiredRole)) extra.add(it.requiredRole)
  return { ...data, roles: [...INITIAL_ROLES, ...[...extra].map(name => ({ name, icon: iconForRoleName(name) }))] }
}

async function exists(p: string): Promise<boolean> {
  try { await fs.access(p); return true } catch { return false }
}

// One-time migration: the app used to keep a single storage/roadmap.json.
// The first time scenario storage is touched, wrap that file (if present) —
// or seed data if this is a brand-new install — into the first scenario,
// marked official, and rename the old file aside so this only runs once.
async function ensureMigrated(): Promise<void> {
  if (await exists(INDEX_FILE)) return
  await fs.mkdir(SCENARIOS_DIR, { recursive: true })

  let data: ScenarioData
  if (await exists(OLD_ROADMAP_FILE)) {
    const raw = JSON.parse(await fs.readFile(OLD_ROADMAP_FILE, 'utf-8'))
    data = ensureRoles({
      projects: raw.projects, items: raw.items, resources: raw.resources,
      deps: raw.deps, sprints: raw.sprints, settings: raw.settings, roles: raw.roles,
    })
    for (const r of data.resources) if (!r.costUnit) r.costUnit = 'month'
    for (const it of data.items) if ((it.type === 'milestone' || it.type === 'release') && it.dur !== 0) it.dur = 0
    await fs.rename(OLD_ROADMAP_FILE, `${OLD_ROADMAP_FILE}.bak`)
  } else {
    data = seedData()
  }

  const id = 's-original'
  const meta: ScenarioMeta = { id, name: 'Roadmap actual', note: '', createdAt: new Date().toISOString(), basedOn: null }
  await fs.writeFile(scenarioFile(id), JSON.stringify(data, null, 2), 'utf-8')
  await fs.writeFile(INDEX_FILE, JSON.stringify({ scenarios: [meta], officialId: id }, null, 2), 'utf-8')
}

async function readIndex(): Promise<ScenarioIndex> {
  await ensureMigrated()
  const raw = await fs.readFile(INDEX_FILE, 'utf-8')
  return JSON.parse(raw) as ScenarioIndex
}

async function writeIndex(index: ScenarioIndex): Promise<void> {
  const tmp = `${INDEX_FILE}.tmp`
  await fs.writeFile(tmp, JSON.stringify(index, null, 2), 'utf-8')
  await fs.rename(tmp, INDEX_FILE)
}

export async function listScenarios(): Promise<ScenarioIndex> {
  return readIndex()
}

export async function readScenario(id: string): Promise<ScenarioData | null> {
  await ensureMigrated()
  try {
    const raw = await fs.readFile(scenarioFile(id), 'utf-8')
    return ensureRoles(JSON.parse(raw) as ScenarioData)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

export async function writeScenario(id: string, data: ScenarioData): Promise<void> {
  const index = await readIndex()
  if (!index.scenarios.some(s => s.id === id)) throw new Error('Unknown scenario')
  data = ensureRoles(data)
  const tmp = `${scenarioFile(id)}.tmp`
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8')
  await fs.rename(tmp, scenarioFile(id))
}

export async function createScenario(opts: { name: string; note: string; basedOn: string }): Promise<ScenarioMeta> {
  const index = await readIndex()
  const source = await readScenario(opts.basedOn)
  if (!source) throw new Error('Unknown source scenario')
  const id = 's' + Date.now()
  const meta: ScenarioMeta = { id, name: opts.name, note: opts.note, createdAt: new Date().toISOString(), basedOn: opts.basedOn }
  await fs.writeFile(scenarioFile(id), JSON.stringify(source, null, 2), 'utf-8')
  index.scenarios.push(meta)
  await writeIndex(index)
  return meta
}

// Marks a scenario as the official plan. Doesn't touch any data — the
// previous official scenario stays intact as a regular scenario, just no
// longer the default one the app loads and the voice agent reads from.
export async function promoteScenario(id: string): Promise<void> {
  const index = await readIndex()
  if (!index.scenarios.some(s => s.id === id)) throw new Error('Unknown scenario')
  index.officialId = id
  await writeIndex(index)
}

export async function deleteScenario(id: string): Promise<void> {
  const index = await readIndex()
  if (index.officialId === id) throw new Error('Cannot delete the official scenario')
  if (index.scenarios.length <= 1) throw new Error('Cannot delete the last scenario')
  index.scenarios = index.scenarios.filter(s => s.id !== id)
  await writeIndex(index)
  await fs.rm(scenarioFile(id), { force: true })
}
