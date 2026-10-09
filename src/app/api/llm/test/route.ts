import { NextResponse } from 'next/server'
import { createLlmFromEnv, LlmError } from '@engine/index'

// A minimal round trip to the configured LLM: asks for {"ok": true} and
// reports how long it took. Settings → Assistant → "Test connection".
export async function POST() {
  const llm = createLlmFromEnv(process.env)
  if (!llm) return NextResponse.json({ ok: false, code: 'missing_key', error: 'ANTHROPIC_API_KEY is not set.' })
  const started = Date.now()
  try {
    const reply = await llm.completeJson({
      system: 'You are a connectivity check. Reply only with the JSON requested.',
      user: 'Reply with {"ok": true}.',
      schema: { type: 'object', additionalProperties: false, required: ['ok'], properties: { ok: { type: 'boolean' } } },
    }) as { ok?: unknown }
    return NextResponse.json({ ok: reply?.ok === true, model: llm.name, ms: Date.now() - started })
  } catch (err) {
    if (err instanceof LlmError) return NextResponse.json({ ok: false, code: 'llm_failed', error: err.message, model: llm.name, ms: Date.now() - started })
    throw err
  }
}
