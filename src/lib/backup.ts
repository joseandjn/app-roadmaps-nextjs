import type { ScenarioData } from '@/types'

// Roadmap backups (docs/settings-backlog.md, P5): one JSON file with one or
// more scenarios, their name, note and full data. Importing a backup always
// creates new scenarios; it never overwrites one. Pure: tested with
// `node --test`.

export const BACKUP_FORMAT = 'roadmap-backup'
export const BACKUP_VERSION = 1

export interface BackupEntry {
  name: string
  note: string
  data: ScenarioData
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: string // ISO
  scenarios: BackupEntry[]
}

export function buildBackup(scenarios: BackupEntry[], exportedAt = new Date().toISOString()): BackupFile {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt, scenarios }
}

// "roadmap-<name>-2026-10-09.json", or "roadmap-backup-…" for several.
export function backupFileName(b: BackupFile): string {
  const day = b.exportedAt.slice(0, 10)
  const base = b.scenarios.length === 1 ? slug(b.scenarios[0].name) || 'scenario' : 'backup'
  return `roadmap-${base}-${day}.json`
}

function slug(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown) => typeof v === 'string' && v.length > 0
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v)

// Checks a scenario's data enough that loading it can't break the app: the
// collections exist with the ids and fields the app relies on. Returns the
// first problem found, or null.
export function scenarioDataProblem(d: unknown): string | null {
  if (!isObj(d)) return 'data is not an object'
  for (const k of ['projects', 'items', 'resources', 'deps', 'sprints'] as const) {
    if (!Array.isArray(d[k])) return `${k} is missing`
    if (!(d[k] as unknown[]).every(isObj)) return `${k} has invalid entries`
  }
  if (!isObj(d.settings)) return 'settings is missing'
  if (d.roles !== undefined && !Array.isArray(d.roles)) return 'roles is invalid'
  const projects = d.projects as Record<string, unknown>[]
  const items = d.items as Record<string, unknown>[]
  if (!projects.every(p => str(p.id) && typeof p.name === 'string')) return 'a project has no id or name'
  if (!items.every(i => str(i.id) && str(i.projectId) && typeof i.title === 'string' && num(i.startDay) && num(i.dur) && Array.isArray(i.assignments))) {
    return 'a task is missing its id, project, title, dates or assignments'
  }
  if (!(d.resources as Record<string, unknown>[]).every(r => str(r.id) && typeof r.name === 'string')) return 'a person has no id or name'
  if (!(d.deps as Record<string, unknown>[]).every(e => str(e.id) && str(e.from) && str(e.to))) return 'a dependency is invalid'
  return null
}

// `error` is a fixed sentence (translatable); `detail` says exactly what's wrong.
export type ParsedBackup = { ok: true; backup: BackupFile } | { ok: false; error: string; detail?: string }

// Reads a backup file's text. Also accepts a bare scenario (the JSON the app
// keeps under storage/scenarios/), as a single scenario named after the file.
export function parseBackup(text: string, fileName = 'scenario'): ParsedBackup {
  let raw: unknown
  try { raw = JSON.parse(text) } catch { return { ok: false, error: 'The file is not valid JSON.' } }

  if (isObj(raw) && raw.format === BACKUP_FORMAT) {
    if (!num(raw.version) || (raw.version as number) > BACKUP_VERSION) return { ok: false, error: 'The backup is from a newer version of the app.' }
    if (!Array.isArray(raw.scenarios) || raw.scenarios.length === 0) return { ok: false, error: 'The backup has no scenarios.' }
    const scenarios: BackupEntry[] = []
    for (const [i, s] of (raw.scenarios as unknown[]).entries()) {
      if (!isObj(s) || !str(s.name)) return { ok: false, error: 'A roadmap in the file has invalid data.', detail: `scenario ${i + 1} has no name` }
      const problem = scenarioDataProblem(s.data)
      if (problem) return { ok: false, error: 'A roadmap in the file has invalid data.', detail: `"${s.name}": ${problem}` }
      scenarios.push({ name: (s.name as string).trim(), note: typeof s.note === 'string' ? s.note : '', data: s.data as ScenarioData })
    }
    return { ok: true, backup: { format: BACKUP_FORMAT, version: raw.version as number, exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '', scenarios } }
  }

  const problem = scenarioDataProblem(raw)
  if (problem) return { ok: false, error: 'This is not a roadmap backup.', detail: problem }
  const name = fileName.replace(/\.json$/i, '').trim() || 'scenario'
  return { ok: true, backup: buildBackup([{ name, note: '', data: raw as ScenarioData }], '') }
}
