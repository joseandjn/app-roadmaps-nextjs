import { NextResponse } from 'next/server'
import { restoreCheckpoint } from '@/lib/persistence/checkpointFile'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string; cid: string }> }) {
  const { id, cid } = await params
  try {
    await restoreCheckpoint(id, cid)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Unknown checkpoint' }, { status: 404 })
  }
}
