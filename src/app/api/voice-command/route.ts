import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { activeProvider, interpretVoiceCommand } from '@/lib/agent/roadmapAgent'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const transcript = body && typeof body.transcript === 'string' ? body.transcript.trim() : ''
  if (!transcript) {
    return NextResponse.json({ type: 'error', error: 'Missing transcript' }, { status: 400 })
  }

  if (activeProvider() === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { type: 'error', error: 'Voice commands need ANTHROPIC_API_KEY set on the server (or unset LLM_PROVIDER to use the local Ollama model instead).' },
      { status: 500 }
    )
  }

  try {
    const result = await interpretVoiceCommand(transcript)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json({ type: 'error', error: `Claude API error: ${err.message}` }, { status: 502 })
    }
    console.error(err)
    const message = err instanceof Error ? err.message : 'Failed to interpret voice command.'
    return NextResponse.json({ type: 'error', error: message }, { status: 500 })
  }
}
