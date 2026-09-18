import { createAnthropicClient } from './anthropic.ts'
import { createOllamaClient } from './ollama.ts'
import type { LlmClient } from './types.ts'

export type Env = Record<string, string | undefined>

// Ollama (local, free) by default; LLM_PROVIDER=anthropic + ANTHROPIC_API_KEY
// switches to Claude. Returns null when Claude is selected without a key.
export function createLlmFromEnv(env: Env): LlmClient | null {
  if (env.LLM_PROVIDER === 'anthropic') {
    return env.ANTHROPIC_API_KEY ? createAnthropicClient({ apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL }) : null
  }
  return createOllamaClient({ baseUrl: env.OLLAMA_BASE_URL, model: env.OLLAMA_MODEL })
}
