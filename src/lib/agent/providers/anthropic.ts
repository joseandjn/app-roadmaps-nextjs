import Anthropic from '@anthropic-ai/sdk'
import { LLM_DEFAULTS } from '@engine/index'
import { buildSystemPrompt, type AgentToolDef, type ItemContext, type ProjectContext, type ResourceContext, type VoiceCommandResult } from '../shared'

const client = new Anthropic()

export async function interpretWithClaude(
  transcript: string,
  resources: ResourceContext[],
  projects: ProjectContext[],
  items: ItemContext[],
  agentTools: AgentToolDef[]
): Promise<VoiceCommandResult> {
  const tools: Anthropic.Tool[] = agentTools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Tool['input_schema'],
  }))

  const response = await client.messages.create({
    // Same model as the analysis and the estimate assistant (engine/llm/fromEnv.ts).
    model: process.env.ANTHROPIC_MODEL || LLM_DEFAULTS.anthropicModel,
    max_tokens: 1024,
    output_config: { effort: 'low' },
    system: buildSystemPrompt(resources, projects, items),
    tools,
    messages: [{ role: 'user', content: transcript }],
  })

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
  )
  if (toolUse) {
    return { type: 'action', name: toolUse.name, input: toolUse.input as Record<string, unknown> }
  }

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join(' ')
    .trim()
  return { type: 'message', text: text || "Sorry, I didn't catch an actionable request." }
}
