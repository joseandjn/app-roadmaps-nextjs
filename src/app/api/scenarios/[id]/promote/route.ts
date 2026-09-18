import { NextResponse } from 'next/server'
import { promoteScenario } from '@/lib/persistence/scenarioFile'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    await promoteScenario(id)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Unknown scenario' }, { status: 404 })
  }
}
