import { NextResponse } from 'next/server'
import { readScenarioWithRevision, writeScenario, StaleRevisionError } from '@/lib/persistence/scenarioFile'
import { createCheckpoint } from '@/lib/persistence/checkpointFile'
import { applyCopy, isCopyPayload } from '@/lib/scenarioCopy'

// Copies tasks from another scenario into this one (see src/lib/scenarioCopy.ts).
// A checkpoint of this scenario is saved first, since the copying tab's undo
// can't reach another scenario. The copy is applied to what's on disk and
// saved against that revision; if another save lands in between, it's
// applied again on top of that one.
const ATTEMPTS = 3

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => null) as { payload?: unknown; checkpointName?: unknown } | null
  if (!body || !isCopyPayload(body.payload)) return NextResponse.json({ error: 'Invalid copy payload' }, { status: 400 })
  const payload = body.payload
  const checkpointName = typeof body.checkpointName === 'string' && body.checkpointName.trim() ? body.checkpointName.trim().slice(0, 120) : 'Before copy'

  if (!(await readScenarioWithRevision(id))) return NextResponse.json({ error: 'Scenario not found' }, { status: 404 })
  const checkpoint = await createCheckpoint(id, { name: checkpointName, note: '' })

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const current = await readScenarioWithRevision(id)
    if (!current) return NextResponse.json({ error: 'Scenario not found' }, { status: 404 })
    const { data, summary } = applyCopy(current.data, payload)
    try {
      const rev = await writeScenario(id, data, current.rev)
      return NextResponse.json({ summary, rev, checkpointId: checkpoint.id }, { headers: { ETag: `"${rev}"` } })
    } catch (err) {
      if (err instanceof StaleRevisionError && attempt < ATTEMPTS) continue
      throw err
    }
  }
  return NextResponse.json({ error: 'The scenario kept changing; try again.' }, { status: 409 })
}
