import { createAnthropicClient } from './anthropic.ts'
import { createOllamaClient } from './ollama.ts'
import type { LlmClient } from './types.ts'

export type Env = Record<string, string | undefined>

export const LLM_DEFAULTS = {
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: 'qwen2.5:latest',
  anthropicModel: 'claude-opus-5',
} as const

// Ollama (local, free) by default; LLM_PROVIDER=anthropic + ANTHROPIC_API_KEY
// switches to Claude. Returns null when Claude is selected without a key.
export function createLlmFromEnv(env: Env): LlmClient | null {
  if (env.LLM_PROVIDER === 'anthropic') {
    return env.ANTHROPIC_API_KEY ? createAnthropicClient({ apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL || LLM_DEFAULTS.anthropicModel }) : null
  }
  return createOllamaClient({ baseUrl: env.OLLAMA_BASE_URL || LLM_DEFAULTS.ollamaBaseUrl, model: env.OLLAMA_MODEL || LLM_DEFAULTS.ollamaModel })
}

export interface LlmEnvInfo {
  provider: 'ollama' | 'anthropic'
  model: string
  baseUrl: string | null // Ollama only
  keyConfigured: boolean // Claude only; the key itself is never exposed
  problem: 'missing_key' | null
}

// What createLlmFromEnv would use, for showing it (Settings → Assistant).
// Never includes the API key, only whether there is one.
export function describeLlmEnv(env: Env): LlmEnvInfo {
  if (env.LLM_PROVIDER === 'anthropic') {
    const keyConfigured = !!env.ANTHROPIC_API_KEY
    return { provider: 'anthropic', model: env.ANTHROPIC_MODEL || LLM_DEFAULTS.anthropicModel, baseUrl: null, keyConfigured, problem: keyConfigured ? null : 'missing_key' }
  }
  return { provider: 'ollama', model: env.OLLAMA_MODEL || LLM_DEFAULTS.ollamaModel, baseUrl: env.OLLAMA_BASE_URL || LLM_DEFAULTS.ollamaBaseUrl, keyConfigured: false, problem: null }
}
