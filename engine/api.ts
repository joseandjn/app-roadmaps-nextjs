import { analyzeRoadmap } from './analyze.ts'
import type { AnalysisReport } from './analyze.ts'
import { parseIsoDate } from './calendar.ts'
import type { EngineItem, EngineResource, EngineSprint, ItemStatus, ItemType, Locale, RoadmapSnapshot } from './domain.ts'
import { narrate } from './llm/narrate.ts'
import type { Narrative } from './llm/narrate.ts'
import type { LlmClient } from './llm/types.ts'

export interface AnalyzeRequest {
  snapshot: RoadmapSnapshot
  // Calendar date (YYYY-MM-DD) that day offset 0 refers to.
  originDate: string
  locale: Locale
  todayDay: number | null
  narrate: boolean
}

export interface AnalyzeResponse extends AnalysisReport {
  narrative: Narrative | null
  narrativeError: string | null
}

export interface EngineRuntime {
  llm: LlmClient | null
}

// Transport-agnostic result: any HTTP layer (Next.js route, a standalone
// server) only has to map `status` and `body` onto its own response type.
export interface ApiResult {
  status: number
  body: AnalyzeResponse | { error: string }
}

const STATUSES: ReadonlySet<string> = new Set<ItemStatus>(['In Progress', 'At Risk', 'Planned', 'Done'])
const TYPES: ReadonlySet<string> = new Set<ItemType>(['epic', 'task', 'milestone', 'release'])
const LIMITS = { items: 5000, resources: 1000, projects: 1000, deps: 20000, sprints: 2000, assignments: 100, holidays: 1000, maxDur: 3650, maxDay: 1_000_000 }

type Parsed = { ok: true; value: AnalyzeRequest } | { ok: false; error: string }

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isString = (v: unknown): v is string => typeof v === 'string' && v.length > 0

export function parseAnalyzeRequest(raw: unknown): Parsed {
  const fail = (error: string): Parsed => ({ ok: false, error })
  if (!isObject(raw)) return fail('Body must be a JSON object.')

  if (typeof raw.originDate !== 'string' || parseIsoDate(raw.originDate) === null) return fail('originDate must be a valid YYYY-MM-DD date.')
  if (!isObject(raw.snapshot)) return fail('snapshot is required.')
  const s = raw.snapshot

  for (const key of ['projects', 'items', 'resources', 'deps'] as const) {
    if (!Array.isArray(s[key])) return fail(`snapshot.${key} must be an array.`)
    if ((s[key] as unknown[]).length > LIMITS[key]) return fail(`snapshot.${key} has too many entries (max ${LIMITS[key]}).`)
  }
  if (!isObject(s.settings) || typeof s.settings.countWeekends !== 'boolean' || !Array.isArray(s.settings.holidays)) {
    return fail('snapshot.settings must have countWeekends (boolean) and holidays (array).')
  }
  if (s.settings.holidays.length > LIMITS.holidays || !s.settings.holidays.every((h: unknown) => typeof h === 'string')) {
    return fail('snapshot.settings.holidays must be an array of date strings.')
  }
  const { workHoursPerDay, currencySymbol } = s.settings
  if (workHoursPerDay !== undefined && (typeof workHoursPerDay !== 'number' || !(workHoursPerDay > 0 && workHoursPerDay <= 24))) {
    return fail('snapshot.settings.workHoursPerDay must be a number between 0 and 24.')
  }
  if (currencySymbol !== undefined && (typeof currencySymbol !== 'string' || currencySymbol.length > 8)) {
    return fail('snapshot.settings.currencySymbol must be a short string.')
  }

  const projects: RoadmapSnapshot['projects'] = []
  for (const p of s.projects as unknown[]) {
    if (!isObject(p) || !isString(p.id) || typeof p.name !== 'string') return fail('Every project needs a string id and name.')
    projects.push({ id: p.id, name: p.name })
  }

  const resources: EngineResource[] = []
  for (const r of s.resources as unknown[]) {
    if (!isObject(r) || !isString(r.id) || typeof r.name !== 'string') return fail('Every resource needs a string id and name.')
    const resource: EngineResource = { id: r.id, name: r.name }
    if (typeof r.role === 'string') resource.role = r.role
    if (r.cost !== undefined && r.cost !== null) {
      if (typeof r.cost !== 'number' || !Number.isFinite(r.cost) || r.cost < 0) return fail(`Resource ${r.id}: cost must be a non-negative number.`)
      resource.cost = r.cost
      resource.costUnit = r.costUnit === 'hour' ? 'hour' : 'month'
    }
    resources.push(resource)
  }

  const sprints: EngineSprint[] = []
  if (s.sprints !== undefined) {
    if (!Array.isArray(s.sprints) || s.sprints.length > LIMITS.sprints) return fail(`snapshot.sprints must be an array (max ${LIMITS.sprints}).`)
    for (const sp of s.sprints as unknown[]) {
      if (!isObject(sp) || !isString(sp.id) || typeof sp.name !== 'string') return fail('Every sprint needs a string id and name.')
      if (!Number.isInteger(sp.startDay) || Math.abs(sp.startDay as number) > LIMITS.maxDay) return fail(`Sprint ${sp.id}: startDay must be an integer day offset.`)
      if (!Number.isInteger(sp.dur) || (sp.dur as number) < 1 || (sp.dur as number) > LIMITS.maxDur) return fail(`Sprint ${sp.id}: dur must be an integer between 1 and ${LIMITS.maxDur}.`)
      sprints.push({ id: sp.id, name: sp.name, startDay: sp.startDay as number, dur: sp.dur as number })
    }
  }

  const items: EngineItem[] = []
  const itemIds = new Set<string>()
  for (const it of s.items as unknown[]) {
    if (!isObject(it) || !isString(it.id) || !isString(it.projectId) || typeof it.title !== 'string') return fail('Every item needs a string id, projectId and title.')
    if (itemIds.has(it.id)) return fail(`Duplicate item id: ${it.id}`)
    itemIds.add(it.id)
    if (!Number.isInteger(it.startDay) || Math.abs(it.startDay as number) > LIMITS.maxDay) return fail(`Item ${it.id}: startDay must be an integer day offset.`)
    if (!Number.isInteger(it.dur) || (it.dur as number) < 0 || (it.dur as number) > LIMITS.maxDur) return fail(`Item ${it.id}: dur must be an integer between 0 and ${LIMITS.maxDur}.`)
    if (typeof it.status !== 'string' || !STATUSES.has(it.status)) return fail(`Item ${it.id}: invalid status.`)
    if (typeof it.type !== 'string' || !TYPES.has(it.type)) return fail(`Item ${it.id}: invalid type.`)
    if (!Array.isArray(it.assignments) || it.assignments.length > LIMITS.assignments) return fail(`Item ${it.id}: assignments must be an array.`)
    const assignments: EngineItem['assignments'] = []
    for (const a of it.assignments as unknown[]) {
      if (!isObject(a) || !isString(a.r) || typeof a.pct !== 'number' || !Number.isFinite(a.pct) || a.pct < 0 || a.pct > 1000) return fail(`Item ${it.id}: invalid assignment.`)
      assignments.push({ r: a.r, pct: a.pct })
    }
    items.push({
      id: it.id, projectId: it.projectId, title: it.title,
      startDay: it.startDay as number, dur: it.dur as number,
      status: it.status as ItemStatus, type: it.type as ItemType, assignments,
    })
  }

  const deps: RoadmapSnapshot['deps'] = []
  for (const d of s.deps as unknown[]) {
    if (!isObject(d) || !isString(d.from) || !isString(d.to)) return fail('Every dependency needs string from and to ids.')
    deps.push({ id: typeof d.id === 'string' ? d.id : `${d.from}>${d.to}`, from: d.from, to: d.to })
  }

  let todayDay: number | null = null
  if (raw.todayDay !== undefined && raw.todayDay !== null) {
    if (!Number.isInteger(raw.todayDay) || Math.abs(raw.todayDay as number) > LIMITS.maxDay) return fail('todayDay must be an integer day offset.')
    todayDay = raw.todayDay as number
  }
  if (raw.locale !== undefined && raw.locale !== 'es' && raw.locale !== 'en') return fail('locale must be "es" or "en".')
  if (raw.narrate !== undefined && typeof raw.narrate !== 'boolean') return fail('narrate must be a boolean.')

  return {
    ok: true,
    value: {
      snapshot: {
        projects, items, resources, deps, sprints,
        settings: {
          countWeekends: s.settings.countWeekends,
          holidays: s.settings.holidays as string[],
          ...(workHoursPerDay !== undefined && { workHoursPerDay }),
          ...(currencySymbol !== undefined && { currencySymbol }),
        },
      },
      originDate: raw.originDate,
      locale: raw.locale === 'en' ? 'en' : 'es',
      todayDay,
      narrate: raw.narrate === true,
    },
  }
}

export async function handleAnalyzeRequest(raw: unknown, runtime: EngineRuntime): Promise<ApiResult> {
  const parsed = parseAnalyzeRequest(raw)
  if (!parsed.ok) return { status: 400, body: { error: parsed.error } }
  const req = parsed.value

  const report = analyzeRoadmap(req.snapshot, { originDate: req.originDate, locale: req.locale, todayDay: req.todayDay })

  let narrative: Narrative | null = null
  let narrativeError: string | null = null
  if (req.narrate && report.findings.length > 0) {
    if (!runtime.llm) {
      narrativeError = 'No LLM provider is configured (set LLM_PROVIDER=anthropic with ANTHROPIC_API_KEY, or run Ollama locally).'
    } else {
      try {
        narrative = await narrate(report, runtime.llm, req.locale)
      } catch (err) {
        narrativeError = err instanceof Error ? err.message : 'The LLM request failed.'
      }
    }
  }

  return { status: 200, body: { ...report, narrative, narrativeError } }
}
