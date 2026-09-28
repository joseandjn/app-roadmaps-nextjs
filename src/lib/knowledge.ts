import type { Item, ScenarioData } from '@/types'
import { createCalendar } from '../../engine/calendar.ts'
import { estimateSummary } from './estimates.ts'

// The estimation knowledge base: one record per finished task, with what it
// was, how it was estimated, how long it really took and what it waited on
// (docs/estimation-knowledge-backlog.md, K6). Pure, so it can be tested with
// `node --test`; the route only reads the scenario and picks the format.

export interface KnowledgeDependency {
  id: string
  title: string
  type: Item['type']
  project: string
  completed: string | null // YYYY-MM-DD
  deviation: number | null // its own vs-original deviation, when it has one
  // Days the task had already started when this dependency finished; 0 when
  // it finished before the start, null when it isn't finished.
  waitDays: number | null
}

export interface KnowledgeRecord {
  id: string
  project: { name: string; category: string }
  title: string
  type: Item['type']
  description: string | null
  requiredRoles: string[]
  assignees: { role: string; pct: number }[]
  estimates: { days: number; date: string; reason?: string }[] // calendar days, oldest first
  start: string
  completed: string
  actual: { calendarDays: number; workingDays: number; personDays: number }
  // (actual - estimate) / estimate; null when the task has no estimate.
  deviation: { vsOriginal: number; vsLatest: number } | null
  dependencies: KnowledgeDependency[]
}

export interface KnowledgeOptions {
  // Also include finished tasks that have no estimate (created before
  // estimates were recorded). Tasks without a completion day are always left
  // out: there's no actual duration to learn from.
  includeUnestimated?: boolean
}

const round1 = (n: number) => Math.round(n * 10) / 10
const round3 = (n: number) => Math.round(n * 1000) / 1000

// `originIso` is the date of day 0 (START_DATE) as YYYY-MM-DD.
export function buildKnowledge(data: ScenarioData, originIso: string, opts: KnowledgeOptions = {}): KnowledgeRecord[] {
  const cal = createCalendar(originIso, data.settings)
  const items = new Map(data.items.map(i => [i.id, i]))
  const projects = new Map(data.projects.map(p => [p.id, p]))
  const roleOf = new Map(data.resources.map(r => [r.id, r.role]))
  const workingDays = (from: number, to: number) => {
    let n = 0
    for (let d = from; d < to; d++) if (cal.isWorking(d)) n++
    return n
  }

  const records: KnowledgeRecord[] = []
  for (const it of data.items) {
    const sum = estimateSummary(it)
    if (sum.actual === null || it.completedDay === undefined) continue
    if (sum.original === null && !opts.includeUnestimated) continue

    const work = workingDays(it.startDay, it.completedDay)
    const project = projects.get(it.projectId)
    const dependencies = data.deps.filter(e => e.from === it.id).flatMap(e => {
      const dep = items.get(e.to)
      if (!dep) return []
      const done = dep.status === 'Done' && dep.completedDay !== undefined
      return [{
        id: dep.id,
        title: dep.title,
        type: dep.type,
        project: projects.get(dep.projectId)?.name ?? '',
        completed: done ? cal.toIso(dep.completedDay!) : null,
        deviation: (() => { const v = estimateSummary(dep).vsOriginal; return v === null ? null : round3(v) })(),
        waitDays: done ? Math.max(0, dep.completedDay! - it.startDay) : null,
      }]
    })

    records.push({
      id: it.id,
      project: { name: project?.name ?? '', category: project?.category ?? '' },
      title: it.title,
      type: it.type,
      description: it.description ?? null,
      requiredRoles: it.requiredRoles ?? [],
      assignees: it.assignments.map(a => ({ role: roleOf.get(a.r) ?? '', pct: a.pct })),
      estimates: (it.estimates ?? []).map(e => ({ days: e.dur, date: e.at.slice(0, 10), ...(e.reason && { reason: e.reason }) })),
      start: cal.toIso(it.startDay),
      completed: cal.toIso(it.completedDay),
      actual: {
        calendarDays: sum.actual,
        workingDays: work,
        personDays: round1(it.assignments.reduce((s, a) => s + work * a.pct / 100, 0)),
      },
      deviation: sum.vsOriginal === null || sum.vsLatest === null ? null : { vsOriginal: round3(sum.vsOriginal), vsLatest: round3(sum.vsLatest) },
      dependencies,
    })
  }
  // Oldest completion first: reads as a history.
  return records.sort((a, b) => a.completed.localeCompare(b.completed) || a.id.localeCompare(b.id))
}

export function toJsonl(records: KnowledgeRecord[]): string {
  return records.map(r => JSON.stringify(r)).join('\n') + (records.length ? '\n' : '')
}

export type KnowledgeLang = 'en' | 'es'

const LABELS = {
  en: {
    title: 'Estimation knowledge base', none: 'No finished tasks with an actual duration yet.',
    type: 'Type', project: 'Project', roles: 'Required roles', anyRole: 'any', assignees: 'Assignees', nobody: 'none',
    original: 'Original estimate', reestimate: 'Re-estimate', noEstimate: 'No estimate recorded',
    actual: 'Actual', calendar: 'calendar days', working: 'working days', person: 'person-days',
    deviation: 'Deviation', vsOriginal: 'vs original', vsLatest: 'vs latest', dates: 'Start → completion',
    deps: 'Depends on', notDone: 'not finished', waited: 'waited {n} d', description: 'Description', noDescription: '(no description)',
  },
  es: {
    title: 'Base de conocimiento de estimaciones', none: 'Todavía no hay tareas terminadas con duración real.',
    type: 'Tipo', project: 'Proyecto', roles: 'Roles requeridos', anyRole: 'cualquiera', assignees: 'Asignados', nobody: 'nadie',
    original: 'Estimación original', reestimate: 'Re-estimación', noEstimate: 'Sin estimación registrada',
    actual: 'Real', calendar: 'días calendario', working: 'días hábiles', person: 'días-persona',
    deviation: 'Desviación', vsOriginal: 'vs. original', vsLatest: 'vs. última', dates: 'Inicio → cierre',
    deps: 'Depende de', notDone: 'sin terminar', waited: 'esperó {n} d', description: 'Descripción', noDescription: '(sin descripción)',
  },
} as const

const pct = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`

export function toMarkdown(records: KnowledgeRecord[], lang: KnowledgeLang = 'en'): string {
  const L = LABELS[lang]
  const out = [`# ${L.title}`, '']
  if (!records.length) out.push(L.none, '')
  for (const r of records) {
    out.push(`## ${r.title}`, '')
    out.push(`- ${L.project}: ${r.project.name}${r.project.category ? ` (${r.project.category})` : ''} · ${L.type}: ${r.type}`)
    out.push(`- ${L.roles}: ${r.requiredRoles.length ? r.requiredRoles.join(', ') : L.anyRole}`)
    // Same role at the same share, grouped: "QA 50% ×4".
    const groups = new Map<string, number>()
    for (const a of r.assignees) { const k = `${a.role || '?'} ${a.pct}%`; groups.set(k, (groups.get(k) ?? 0) + 1) }
    out.push(`- ${L.assignees}: ${groups.size ? [...groups].map(([k, n]) => n > 1 ? `${k} ×${n}` : k).join(', ') : L.nobody}`)
    if (!r.estimates.length) out.push(`- ${L.noEstimate}`)
    r.estimates.forEach((e, i) => out.push(`- ${i === 0 ? L.original : L.reestimate}: ${e.days} d (${e.date})${e.reason ? ` — ${e.reason}` : ''}`))
    out.push(`- ${L.actual}: ${r.actual.calendarDays} ${L.calendar}, ${r.actual.workingDays} ${L.working}, ${r.actual.personDays} ${L.person}`)
    if (r.deviation) out.push(`- ${L.deviation}: ${pct(r.deviation.vsOriginal)} ${L.vsOriginal}${r.estimates.length > 1 ? `, ${pct(r.deviation.vsLatest)} ${L.vsLatest}` : ''}`)
    out.push(`- ${L.dates}: ${r.start} → ${r.completed}`)
    for (const d of r.dependencies) {
      const parts = [d.completed ?? L.notDone]
      if (d.deviation !== null) parts.push(`${pct(d.deviation)} ${L.vsOriginal}`)
      if (d.waitDays) parts.push(L.waited.replace('{n}', String(d.waitDays)))
      out.push(`- ${L.deps}: ${d.title}${d.project ? ` (${d.project})` : ''} — ${parts.join(', ')}`)
    }
    out.push('', `### ${L.description}`, '', r.description ?? L.noDescription, '')
  }
  return out.join('\n')
}
