import { NextResponse } from 'next/server'
import { describeLlmEnv } from '@engine/index'

// Which LLM the app uses (from .env), for Settings → Assistant. Never returns
// the API key. For Ollama it also checks the server answers and whether the
// model is installed.
export async function GET() {
  const info = describeLlmEnv(process.env)
  if (info.provider !== 'ollama' || !info.baseUrl) return NextResponse.json(info)

  let reachable = false
  let models: string[] = []
  try {
    const res = await fetch(`${info.baseUrl}/api/tags`, { signal: AbortSignal.timeout(2500), cache: 'no-store' })
    if (res.ok) {
      reachable = true
      const body = await res.json() as { models?: { name?: string }[] }
      models = (body.models ?? []).map(m => m.name ?? '').filter(Boolean)
    }
  } catch { /* not running or not reachable */ }
  const installed = models.some(m => m === info.model || m === `${info.model}:latest`)
  return NextResponse.json({ ...info, ollama: { reachable, models, installed } })
}
