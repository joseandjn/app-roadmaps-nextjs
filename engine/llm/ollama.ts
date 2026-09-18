import { LlmError } from './types.ts'
import type { LlmClient } from './types.ts'

export function createOllamaClient(options: { baseUrl?: string; model?: string }): LlmClient {
  const baseUrl = options.baseUrl ?? 'http://localhost:11434'
  const model = options.model ?? 'qwen2.5:latest'

  return {
    name: `ollama:${model}`,
    async completeJson({ system, user, schema }) {
      let res: Response
      try {
        res = await fetch(`${baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(120_000),
          body: JSON.stringify({
            model,
            stream: false,
            format: schema,
            options: { temperature: 0 },
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
          }),
        })
      } catch (err) {
        throw new LlmError(`Could not reach Ollama at ${baseUrl}: ${err instanceof Error ? err.message : String(err)}`)
      }
      if (!res.ok) throw new LlmError(`Ollama request failed (${res.status}): ${(await res.text()).slice(0, 300)}`)

      const data = (await res.json()) as { message?: { content?: string } }
      try {
        return JSON.parse(data.message?.content ?? '')
      } catch {
        throw new LlmError('Ollama returned a reply that is not valid JSON.')
      }
    },
  }
}
