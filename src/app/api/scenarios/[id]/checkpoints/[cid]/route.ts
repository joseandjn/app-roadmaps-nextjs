import { NextResponse } from 'next/server'
import { readCheckpoint, deleteCheckpoint } from '@/lib/persistence/checkpointFile'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; cid: string }> }) {
  const { id, cid } = await params
  const checkpoint = await readCheckpoint(id, cid)
  if (!checkpoint) return NextResponse.json({ error: 'Checkpoint not found' }, { status: 404 })
  return NextResponse.json(checkpoint)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; cid: string }> }) {
  const { id, cid } = await params
  await deleteCheckpoint(id, cid)
  return NextResponse.json({ ok: true })
}
