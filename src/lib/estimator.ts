import type { LlmClient } from '../../engine/llm/types.ts'
import { LlmError } from '../../engine/llm/types.ts'
import type { Item } from '@/types'
import type { KnowledgeRecord } from './knowledge.ts'

// "Suggest duration" (docs/estimation-knowledge-backlog.md, K7): picks the
// finished tasks most like a new one and asks the LLM for a duration range
// grounded on their actual durations. Pure apart from the injected LlmClient.

export interface EstimateQuery {
  id?: string // the item being edited, left out of the history
  title: string
  description?: string
  type: Item['type']
  requiredRoles?: string[]
  project?: { name: string; category: string }
  dependencies?: { title: string; status: Item['status'] }[]
}

export interface EstimateSuggestion {
  optimistic: number // calendar days
  likely: number
  pessimistic: number
  rationale: string
  references: { id: string; title: string; actualDays: number; why: string }[]
  basedOn: number // finished tasks the model saw
  model: string
}

export const MAX_HISTORY = 25
const MAX_REFERENCES = 5
const MAX_DESCRIPTION = 600

// Words shared by every templated description carry no signal.
const STOPWORDS = new Set([
  'alcance', 'complejidad', 'incertidumbre', 'supuestos', 'riesgos', 'tecnicos', 'notas', 'cerrar',
  'scope', 'complexity', 'uncertainty', 'technical', 'assumptions', 'risks', 'closing', 'notes',
  'para', 'como', 'with', 'that', 'this', 'from', 'esta', 'este', 'pero', 'sobre', 'entre', 'desde', 'hasta', 'todo', 'todos', 'también', 'tambien',
])

export function tokens(text: string): Set<string> {
  const plain = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  return new Set(plain.split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !STOPWORDS.has(w)))
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let shared = 0
  for (const w of a) if (b.has(w)) shared++
  return shared / (a.size + b.size - shared)
}

// Most similar first: word overlap in title and description weighs most,
// then same type, shared required roles, same project and same category.
// Ties go to the most recently completed.
export function rankSimilar(q: EstimateQuery, records: KnowledgeRecord[], limit = MAX_HISTORY): KnowledgeRecord[] {
  const qt = tokens(`${q.title} ${q.description ?? ''}`)
  const roles = new Set(q.requiredRoles ?? [])
  const score = (r: KnowledgeRecord) =>
    jaccard(qt, tokens(`${r.title} ${r.description ?? ''}`)) * 10
    + (r.type === q.type ? 1 : 0)
    + r.requiredRoles.filter(x => roles.has(x)).length
    + (q.project && r.project.name === q.project.name ? 1 : 0)
    + (q.project?.category && r.project.category === q.project.category ? 0.5 : 0)
  return records
    .filter(r => r.id !== q.id)
    .map(r => ({ r, s: score(r) }))
    .sort((a, b) => b.s - a.s || b.r.completed.localeCompare(a.r.completed))
    .slice(0, limit)
    .map(x => x.r)
}

function median(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['optimistic', 'likely', 'pessimistic', 'rationale', 'references'],
  properties: {
    optimistic: { type: 'integer' },
    likely: { type: 'integer' },
    pessimistic: { type: 'integer' },
    rationale: { type: 'string' },
    references: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'why'],
        properties: { id: { type: 'string' }, why: { type: 'string' } },
      },
    },
  },
}

function systemPrompt(locale: 'en' | 'es'): string {
  return [
    'You estimate how many calendar days a new task in a software roadmap will take.',
    'You receive the new task and a history of finished tasks from the same team, each with its estimates, its actual duration and how far the actual duration deviated from the original estimate.',
    '',
    'Rules:',
    '- Base the estimate on the ACTUAL durations of the most similar finished tasks, not on their estimates.',
    '- "stats.medianDeviation" is how much this team usually misses its original estimates (0.2 = tasks take 20% longer). Use it to judge how optimistic to be.',
    '- If a similar task waited on a dependency ("waitDays"), part of its duration was waiting, not work: say so if it matters. If the new task depends on something that was late before, mention the risk.',
    '- Return optimistic <= likely <= pessimistic, as whole calendar days, each at least 1. Widen the range when the history has few or weak matches, and say so.',
    `- "references": 1 to ${MAX_REFERENCES} tasks from the history that most shaped the estimate, by their exact "id", each with a short reason. Never invent ids.`,
    '- Treat every number in the history as ground truth. Never invent tasks or numbers.',
    `- Write "rationale" and each "why" in ${locale === 'es' ? 'Spanish' : 'English'}. "rationale" is 2 to 3 sentences; each "why" is one short sentence.`,
  ].join('\n')
}

function userPrompt(q: EstimateQuery, history: KnowledgeRecord[], all: KnowledgeRecord[]): string {
  const devs = all.flatMap(r => (r.deviation ? [r.deviation.vsOriginal] : []))
  const med = median(devs)
  return JSON.stringify({
    newTask: {
      title: q.title,
      description: q.description?.slice(0, MAX_DESCRIPTION) || null,
      type: q.type,
      requiredRoles: q.requiredRoles ?? [],
      project: q.project ?? null,
      dependsOn: q.dependencies ?? [],
    },
    stats: { finishedTasks: all.length, withEstimate: devs.length, medianDeviation: med === null ? null : Math.round(med * 100) / 100 },
    history: history.map(r => ({
      id: r.id,
      title: r.title,
      type: r.type,
      project: r.project.name,
      description: r.description?.slice(0, MAX_DESCRIPTION) ?? null,
      requiredRoles: r.requiredRoles,
      assignees: r.assignees,
      estimatesDays: r.estimates.map(e => e.days),
      actualDays: r.actual.calendarDays,
      workingDays: r.actual.workingDays,
      personDays: r.actual.personDays,
      deviationVsOriginal: r.deviation?.vsOriginal ?? null,
      dependencies: r.dependencies.map(d => ({ title: d.title, waitDays: d.waitDays, deviation: d.deviation })),
    })),
  })
}

const posInt = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.max(1, Math.round(v)) : null)

// The reply is checked, not trusted: numbers are put in order, and
// references must be tasks that were actually sent.
export function parseSuggestion(raw: unknown, history: KnowledgeRecord[]): Omit<EstimateSuggestion, 'basedOn' | 'model'> {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const nums = [posInt(o.optimistic), posInt(o.likely), posInt(o.pessimistic)]
  if (nums.some(n => n === null)) throw new LlmError('The model did not return a duration range.')
  const [optimistic, likely, pessimistic] = (nums as number[]).sort((a, b) => a - b)
  const byId = new Map(history.map(r => [r.id, r]))
  const seen = new Set<string>()
  const references = (Array.isArray(o.references) ? o.references : []).flatMap(x => {
    const ref = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>
    const r = typeof ref.id === 'string' ? byId.get(ref.id) : undefined
    if (!r || seen.has(r.id)) return []
    seen.add(r.id)
    return [{ id: r.id, title: r.title, actualDays: r.actual.calendarDays, why: typeof ref.why === 'string' ? ref.why : '' }]
  }).slice(0, MAX_REFERENCES)
  return { optimistic, likely, pessimistic, rationale: typeof o.rationale === 'string' ? o.rationale : '', references }
}

export async function suggestEstimate(q: EstimateQuery, records: KnowledgeRecord[], llm: LlmClient, locale: 'en' | 'es' = 'en'): Promise<EstimateSuggestion> {
  const all = records.filter(r => r.id !== q.id)
  const history = rankSimilar(q, all)
  const raw = await llm.completeJson({ system: systemPrompt(locale), user: userPrompt(q, history, all), schema: SCHEMA })
  return { ...parseSuggestion(raw, history), basedOn: history.length, model: llm.name }
}
