import Anthropic from '@anthropic-ai/sdk'
import { LlmError } from './types.ts'
import type { LlmClient } from './types.ts'

export function createAnthropicClient(options: { apiKey: string; model?: string }): LlmClient {
  const client = new Anthropic({ apiKey: options.apiKey, timeout: 60_000 })
  const model = options.model ?? 'claude-opus-5'

  return {
    name: `anthropic:${model}`,
    async completeJson({ system, user, schema }) {
      let response: Anthropic.Message
      try {
        response = await client.messages.create({
          model,
          max_tokens: 8000,
          output_config: { effort: 'low', format: { type: 'json_schema', schema } },
          system,
          messages: [{ role: 'user', content: user }],
        })
      } catch (err) {
        if (err instanceof Anthropic.APIError) throw new LlmError(`Claude API error (${err.status ?? 'network'}): ${err.message}`)
        throw err
      }

      if (response.stop_reason === 'refusal') throw new LlmError('Claude declined to answer this request.')
      if (response.stop_reason === 'max_tokens') throw new LlmError('Claude ran out of output tokens before finishing.')

      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map(b => b.text)
        .join('')
      try {
        return JSON.parse(text)
      } catch {
        throw new LlmError('Claude returned a reply that is not valid JSON.')
      }
    },
  }
}
