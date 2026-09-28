import { NextResponse, type NextRequest } from 'next/server'
import { listScenarios, readScenario } from '@/lib/persistence/scenarioFile'
import { buildKnowledge, toJsonl, toMarkdown } from '@/lib/knowledge'
import { dateStr } from '@/lib/roadmapUtils'

// The estimation knowledge base: finished tasks of the official scenario only
// (the others are copies with the same ids, so they'd repeat every task).
//   ?format=jsonl (default) | md
//   ?lang=en (default) | es — Markdown labels
//   ?includeUnestimated=1   — also tasks without an estimate
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams
  const format = q.get('format') ?? 'jsonl'
  if (format !== 'jsonl' && format !== 'md') {
    return NextResponse.json({ error: 'format must be jsonl or md' }, { status: 400 })
  }

  const { officialId } = await listScenarios()
  const data = await readScenario(officialId)
  if (!data) return NextResponse.json({ error: 'Official scenario not found' }, { status: 404 })

  const records = buildKnowledge(data, dateStr(0), { includeUnestimated: q.get('includeUnestimated') === '1' })
  const headers = { 'Cache-Control': 'no-store', 'X-Record-Count': String(records.length) }
  return format === 'md'
    ? new Response(toMarkdown(records, q.get('lang') === 'es' ? 'es' : 'en'), { headers: { ...headers, 'Content-Type': 'text/markdown; charset=utf-8' } })
    : new Response(toJsonl(records), { headers: { ...headers, 'Content-Type': 'application/x-ndjson; charset=utf-8' } })
}
