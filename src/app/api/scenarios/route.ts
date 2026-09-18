import { NextResponse } from 'next/server'
import { listScenarios, createScenario } from '@/lib/persistence/scenarioFile'

export async function GET() {
  const { scenarios, officialId } = await listScenarios()
  return NextResponse.json({ scenarios, officialId })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { name?: string; note?: string; basedOn?: string } | null
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
