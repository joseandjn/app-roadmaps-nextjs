import { promises as fs } from 'fs'
import path from 'path'
import { listScenarios } from './scenarioFile'
import { STATUS_ORDER, ITEM_TYPES } from '@/data/initialData'
import type { PersistedFilters } from '@/types'

const STORAGE_DIR = path.join(process.cwd(), 'storage')
const VIEW_FILE = path.join(STORAGE_DIR, 'view.json')

export interface ViewState {
  filterStartDay: number | null
  filterEndDay: number | null
  activeScenarioId: string
  filters: PersistedFilters
  // Hidden rather than visible, so projects created later show up by default.
  hiddenProjectIds: string[]
}

// Accepts anything and returns well-formed filters: unknown fields dropped,
// bad values replaced by "no filter". Older view.json files have none of
// these fields and come back as all defaults.
export function sanitizeFilters(raw: unknown): PersistedFilters {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const strings = (v: unknown) => Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  return {
    resourceIds: strings(r.resourceIds),
    roles: strings(r.roles),
    statuses: STATUS_ORDER.filter(s => strings(r.statuses).includes(s)),
    types: ITEM_TYPES.filter(ty => strings(r.types).includes(ty)),
    onlyIssues: r.onlyIssues === true,
    unassigned: r.unassigned === true,
    uncovered: r.uncovered === true,
  }
}

export function sanitizeIds(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []
}

export async function readViewState(): Promise<ViewState> {
  const { officialId } = await listScenarios()
  try {
    const raw = JSON.parse(await fs.readFile(VIEW_FILE, 'utf-8')) as Partial<ViewState>
    return {
      filterStartDay: raw.filterStartDay ?? null,
      filterEndDay: raw.filterEndDay ?? null,
      activeScenarioId: raw.activeScenarioId ?? officialId,
      filters: sanitizeFilters(raw.filters),
      hiddenProjectIds: sanitizeIds(raw.hiddenProjectIds),
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { filterStartDay: null, filterEndDay: null, activeScenarioId: officialId, filters: sanitizeFilters(null), hiddenProjectIds: [] }
    }
    throw err
  }
}

export async function writeViewState(state: ViewState): Promise<void> {
  await fs.mkdir(STORAGE_DIR, { recursive: true })
  const tmp = `${VIEW_FILE}.tmp`
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), 'utf-8')
  await fs.rename(tmp, VIEW_FILE)
}
