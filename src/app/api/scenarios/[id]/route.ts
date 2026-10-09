import { NextResponse } from 'next/server'
import { readScenarioWithRevision, writeScenario, deleteScenario, updateScenarioMeta, StaleRevisionError } from '@/lib/persistence/scenarioFile'
import type { ScenarioData } from '@/types'

function isValidScenarioData(body: unknown): body is ScenarioData {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  return Array.isArray(b.projects) && Array.isArray(b.items) && Array.isArray(b.resources) && Array.isArray(b.deps) && Array.isArray(b.sprints) && typeof b.settings === 'object' && b.settings !== null
}

// The scenario's revision travels as an ETag: GET sends it, a GET with
// If-None-Match gets 304 while it's unchanged, and PUT must send it back in
// If-Match. A PUT against an older revision gets 409 with the current data,
// so a tab never overwrites a save it hasn't seen.
const etag = (rev: string) => `"${rev}"`
const revFrom = (header: string | null) => header?.replace(/^W\//, '').replace(/"/g, '').trim() || null

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const found = await readScenarioWithRevision(id)
  if (!found) return NextResponse.json({ error: 'Scenario not found' }, { status: 404 })
  if (revFrom(request.headers.get('if-none-match')) === found.rev) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag(found.rev) } })
  }
  return NextResponse.json(found.data, { headers: { ETag: etag(found.rev) } })
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const baseRev = revFrom(request.headers.get('if-match'))
  if (!baseRev) return NextResponse.json({ error: 'If-Match required' }, { status: 428 })
  const body = await request.json().catch(() => null)
  if (!isValidScenarioData(body)) {
    return NextResponse.json({ error: 'Invalid scenario payload' }, { status: 400 })
  }
  try {
    const rev = await writeScenario(id, body, baseRev)
    return NextResponse.json({ ok: true, rev }, { headers: { ETag: etag(rev) } })
  } catch (err) {
    if (err instanceof StaleRevisionError) {
      const { data, rev } = err.current
      return NextResponse.json({ error: 'Stale revision', data, rev }, { status: 409, headers: { ETag: etag(rev) } })
    }
    return NextResponse.json({ error: 'Unknown scenario' }, { status: 404 })
  }
}

// Rename a scenario or change its note: { name?, note? }.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => null) as { name?: unknown; note?: unknown } | null
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 120) : undefined
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 500) : undefined
  if (name === '' || (name === undefined && note === undefined)) {
    return NextResponse.json({ error: 'A non-empty name or a note is required' }, { status: 400 })
  }
  try {
    return NextResponse.json(await updateScenarioMeta(id, { name, note }))
  } catch {
    return NextResponse.json({ error: 'Unknown scenario' }, { status: 404 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    await deleteScenario(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }
}
