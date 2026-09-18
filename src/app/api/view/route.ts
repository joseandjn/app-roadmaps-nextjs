import { NextResponse } from 'next/server'
import { readViewState, writeViewState, type ViewState } from '@/lib/persistence/viewFile'

function isValidViewState(body: unknown): body is ViewState {
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
  await writeViewState(body)
  return NextResponse.json({ ok: true })
}
