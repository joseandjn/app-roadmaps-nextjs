import { NextResponse } from 'next/server'
import { createLlmFromEnv, LlmError } from '@engine/index'
import { listScenarios, readScenario } from '@/lib/persistence/scenarioFile'
import { buildKnowledge } from '@/lib/knowledge'
import { suggestEstimate, type EstimateQuery } from '@/lib/estimator'
import { dateStr } from '@/lib/roadmapUtils'
import { STATUS_ORDER, ITEM_TYPES } from '@/data/initialData'
import type { Item } from '@/types'

// Suggests a duration for a task from the official scenario's finished tasks
// (the knowledge base of /api/knowledge, including unestimated ones: their
// actual duration is what matters here). Errors carry a `code` the client
// can explain: bad_request, no_history, no_llm, llm_failed.

const str = (v: unknown, max: number): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)

function parseQuery(raw: unknown): EstimateQuery | null {
  if (!raw || typeof raw !== 'object') return null
  const b = raw as Record<string, unknown>
  const title = str(b.title, 200)
  if (!title || !ITEM_TYPES.includes(b.type as never) || b.type === 'milestone' || b.type === 'release') return null
  const project = b.project && typeof b.project === 'object' ? b.project as Record<string, unknown> : null
  const deps = Array.isArray(b.dependencies) ? b.dependencies.slice(0, 20) : []
  return {
    id: str(b.id, 100),
    title,
    description: str(b.description, 4000),
    type: b.type as EstimateQuery['type'],
    requiredRoles: Array.isArray(b.requiredRoles) ? b.requiredRoles.filter((r): r is string => typeof r === 'string').slice(0, 20) : [],
    project: project ? { name: str(project.name, 200) ?? '', category: str(project.category, 100) ?? '' } : undefined,
    dependencies: deps.flatMap(d => {
      const o = d && typeof d === 'object' ? d as Record<string, unknown> : {}
      const t = str(o.title, 200)
      return t && STATUS_ORDER.includes(o.status as never) ? [{ title: t, status: o.status as Item['status'] }] : []
    }),
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const query = parseQuery(body)
  if (!query) return NextResponse.json({ code: 'bad_request', error: 'A task title and a task/epic type are required.' }, { status: 400 })

  const llm = createLlmFromEnv(process.env)
  if (!llm) return NextResponse.json({ code: 'no_llm', error: 'No LLM is configured.' }, { status: 503 })

  const { officialId } = await listScenarios()
  const data = await readScenario(officialId)
  const records = data ? buildKnowledge(data, dateStr(0), { includeUnestimated: true }).filter(r => r.id !== query.id) : []
  if (!records.length) return NextResponse.json({ code: 'no_history', error: 'There are no finished tasks with an actual duration yet.' }, { status: 409 })

  const locale = (body as { locale?: unknown }).locale === 'es' ? 'es' : 'en'
  try {
    return NextResponse.json(await suggestEstimate(query, records, llm, locale))
  } catch (err) {
    if (err instanceof LlmError) return NextResponse.json({ code: 'llm_failed', error: err.message }, { status: 502 })
    throw err
  }
}
