import { readScenario } from '@/lib/persistence/scenarioFile'
import { readViewState } from '@/lib/persistence/viewFile'
import { interpretWithOllama } from './providers/ollama'
import { interpretWithClaude } from './providers/anthropic'
import { buildAgentTools } from './shared'
import type { VoiceCommandResult } from './shared'

export type { VoiceCommandResult } from './shared'

// Defaults to the local Ollama model (no API key, no cost). Set
// LLM_PROVIDER=anthropic (+ ANTHROPIC_API_KEY) to use Claude instead.
export function activeProvider(): 'ollama' | 'anthropic' {
  return process.env.LLM_PROVIDER === 'anthropic' ? 'anthropic' : 'ollama'
}

export async function interpretVoiceCommand(transcript: string): Promise<VoiceCommandResult> {
  const { activeScenarioId } = await readViewState()
  const data = await readScenario(activeScenarioId)
  if (!data) return { type: 'message', text: "Couldn't load the active scenario" }
  const { projects, resources, items, roles } = data
  const resourceContext = resources.map(r => ({ id: r.id, name: r.name, role: r.role, cost: r.cost, costUnit: r.costUnit }))
  const projectContext = projects.map(p => ({ id: p.id, name: p.name, owner: p.owner, category: p.category, status: p.status }))
  const itemContext = items.map(i => ({ id: i.id, title: i.title, projectId: i.projectId, type: i.type, status: i.status, requiredRoles: i.requiredRoles ?? [] }))
  const tools = buildAgentTools(roles.map(r => r.name))

  return activeProvider() === 'anthropic'
    ? interpretWithClaude(transcript, resourceContext, projectContext, itemContext, tools)
    : interpretWithOllama(transcript, resourceContext, projectContext, itemContext, tools)
}
