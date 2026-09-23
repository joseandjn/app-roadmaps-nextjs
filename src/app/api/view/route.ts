import { NextResponse } from 'next/server'
import { readViewState, writeViewState, sanitizeFilters, sanitizeIds } from '@/lib/persistence/viewFile'

// Filters and hidden projects are optional and sanitized rather than
// rejected, so an older client (or a partial payload) can still save.
function isValidViewState(body: unknown): body is { filterStartDay: number | null; filterEndDay: number | null; activeScenarioId: string; filters?: unknown; hiddenProjectIds?: unknown } {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  return (typeof b.filterStartDay === 'number' || b.filterStartDay === null)
    && (typeof b.filterEndDay === 'number' || b.filterEndDay === null)
    && typeof b.activeScenarioId === 'string'
}

export async function GET() {
  const state = await readViewState()
  return NextResponse.json(state)
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null)
  if (!isValidViewState(body)) {
    return NextResponse.json({ error: 'Invalid view payload' }, { status: 400 })
  }
  await writeViewState({
    filterStartDay: body.filterStartDay,
    filterEndDay: body.filterEndDay,
    activeScenarioId: body.activeScenarioId,
    filters: sanitizeFilters(body.filters),
    hiddenProjectIds: sanitizeIds(body.hiddenProjectIds),
  })
  return NextResponse.json({ ok: true })
}
