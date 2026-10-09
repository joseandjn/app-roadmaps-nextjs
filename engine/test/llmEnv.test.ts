import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { describeLlmEnv, LLM_DEFAULTS } from '../llm/fromEnv.ts'

describe('describeLlmEnv', () => {
  it('defaults to local Ollama', () => {
    assert.deepEqual(describeLlmEnv({}), { provider: 'ollama', model: LLM_DEFAULTS.ollamaModel, baseUrl: LLM_DEFAULTS.ollamaBaseUrl, keyConfigured: false, problem: null })
  })

  it('uses the configured Ollama model and server', () => {
    const info = describeLlmEnv({ OLLAMA_MODEL: 'llama3', OLLAMA_BASE_URL: 'http://gpu:11434' })
    assert.equal(info.model, 'llama3')
    assert.equal(info.baseUrl, 'http://gpu:11434')
  })

  it('reports Claude, and a missing key, without ever exposing the key', () => {
    assert.equal(describeLlmEnv({ LLM_PROVIDER: 'anthropic' }).problem, 'missing_key')
    const info = describeLlmEnv({ LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk-secret', ANTHROPIC_MODEL: 'claude-x' })
    assert.deepEqual(info, { provider: 'anthropic', model: 'claude-x', baseUrl: null, keyConfigured: true, problem: null })
    assert.equal(JSON.stringify(info).includes('sk-secret'), false)
  })
})
