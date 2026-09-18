import { NextResponse } from 'next/server'
import { readScenario, writeScenario, deleteScenario } from '@/lib/persistence/scenarioFile'
import type { ScenarioData } from '@/types'

function isValidScenarioData(body: unknown): body is ScenarioData {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  return Array.isArray(b.projects) && Array.isArray(b.items) && Array.isArray(b.resources) && Array.isArray(b.deps) && Array.isArray(b.sprints) && typeof b.settings === 'object' && b.settings !== null
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await readScenario(id)
  if (!data) return NextResponse.json({ error: 'Scenario not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!isValidScenarioData(body)) {
    return NextResponse.json({ error: 'Invalid scenario payload' }, { status: 400 })
  }
  try {
    await writeScenario(id, body)
    return NextResponse.json({ ok: true })
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
