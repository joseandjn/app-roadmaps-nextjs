import { LLM_DEFAULTS } from '@engine/index'
import { buildSystemPrompt, type AgentToolDef, type ItemContext, type ProjectContext, type ResourceContext, type VoiceCommandResult } from '../shared'

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || LLM_DEFAULTS.ollamaBaseUrl
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || LLM_DEFAULTS.ollamaModel

interface OllamaToolCall {
  function: { name: string; arguments: Record<string, unknown> }
}

interface OllamaChatResponse {
  message?: { content?: string; tool_calls?: OllamaToolCall[] }
}

export async function interpretWithOllama(
  transcript: string,
  resources: ResourceContext[],
  projects: ProjectContext[],
  items: ItemContext[],
  agentTools: AgentToolDef[]
): Promise<VoiceCommandResult> {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      messages: [
        { role: 'system', content: buildSystemPrompt(resources, projects, items) },
        { role: 'user', content: transcript },
      ],
      tools: agentTools.map(t => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      })),
    }),
  })

  if (!res.ok) {
    throw new Error(`Ollama request failed (${res.status}): ${(await res.text()).slice(0, 300)}`)
  }

  const data = (await res.json()) as OllamaChatResponse
  const call = data.message?.tool_calls?.[0]
  if (call) {
    return { type: 'action', name: call.function.name, input: call.function.arguments }
  }

  const text = data.message?.content?.trim()
  return { type: 'message', text: text || "Sorry, I didn't catch an actionable request." }
}
