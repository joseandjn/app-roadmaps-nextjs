import { NextResponse } from 'next/server'
import { listScenarios, createScenario, createScenarioFromData } from '@/lib/persistence/scenarioFile'
import { scenarioDataProblem } from '@/lib/backup'
import type { ScenarioData } from '@/types'

export async function GET() {
  const { scenarios, officialId } = await listScenarios()
  return NextResponse.json({ scenarios, officialId })
}

// Creates a scenario: a copy of `basedOn`, or — with `data` — an imported
// one (a backup), validated first. Either way it's always a new scenario.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { name?: string; note?: string; basedOn?: string; data?: unknown } | null
  if (body && body.data !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })
    const problem = scenarioDataProblem(body.data)
    if (problem) return NextResponse.json({ error: `Invalid scenario data: ${problem}` }, { status: 400 })
    const meta = await createScenarioFromData({ name: body.name.trim().slice(0, 120), note: typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '', data: body.data as ScenarioData })
    return NextResponse.json(meta)
  }
  if (!body || typeof body.name !== 'string' || !body.name.trim() || typeof body.basedOn !== 'string') {
    return NextResponse.json({ error: 'name and basedOn are required' }, { status: 400 })
  }
  try {
    const meta = await createScenario({ name: body.name.trim(), note: body.note?.trim() ?? '', basedOn: body.basedOn })
    return NextResponse.json(meta)
  } catch {
    return NextResponse.json({ error: 'Unknown source scenario' }, { status: 400 })
  }
}
