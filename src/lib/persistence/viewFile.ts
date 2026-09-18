import { promises as fs } from 'fs'
import path from 'path'
import { listScenarios } from './scenarioFile'

const STORAGE_DIR = path.join(process.cwd(), 'storage')
const VIEW_FILE = path.join(STORAGE_DIR, 'view.json')

export interface ViewState {
  filterStartDay: number | null
  filterEndDay: number | null
  activeScenarioId: string
}

export async function readViewState(): Promise<ViewState> {
  const { officialId } = await listScenarios()
  try {
    const raw = JSON.parse(await fs.readFile(VIEW_FILE, 'utf-8')) as Partial<ViewState>
    return {
      filterStartDay: raw.filterStartDay ?? null,
      filterEndDay: raw.filterEndDay ?? null,
      activeScenarioId: raw.activeScenarioId ?? officialId,
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { filterStartDay: null, filterEndDay: null, activeScenarioId: officialId }
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
