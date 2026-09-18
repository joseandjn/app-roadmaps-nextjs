import { NextResponse } from 'next/server'
import { listCheckpoints, createCheckpoint } from '@/lib/persistence/checkpointFile'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const checkpoints = await listCheckpoints(id)
  return NextResponse.json(checkpoints)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => null) as { name?: string; note?: string } | null
  if (!body || typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  try {
    const meta = await createCheckpoint(id, { name: body.name.trim(), note: body.note?.trim() ?? '' })
    return NextResponse.json(meta)
  } catch {
    return NextResponse.json({ error: 'Unknown scenario' }, { status: 404 })
  }
}
