import type { AnalysisReport } from '../analyze.ts'
import type { Locale } from '../domain.ts'
import { LlmError } from './types.ts'
import type { LlmClient } from './types.ts'

export interface Narrative {
  summary: string
  priorities: Array<{ findingId: string; why: string; action: string }>
  model: string
}

const MAX_PRIORITIES = 5
const MAX_FINDINGS_SENT = 30

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'priorities'],
  properties: {
    summary: { type: 'string' },
    priorities: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['findingId', 'why', 'action'],
        properties: {
          findingId: { type: 'string' },
          why: { type: 'string' },
          action: { type: 'string' },
        },
      },
    },
  },
}

function systemPrompt(locale: Locale): string {
  return [
    'You are a delivery planning analyst reviewing a project roadmap.',
    'You receive findings that were computed deterministically from the roadmap data: overloaded people, work assigned while someone is on time off, dependency conflicts and cycles, and critical paths. Your job is to explain and prioritize them, not to recompute anything.',
    '',
    'Rules:',
    '- Treat every number, date and name in the findings as ground truth. Never invent or adjust them.',
    '- Refer to findings only by their exact "id".',
    `- Choose at most ${MAX_PRIORITIES} findings that deserve attention first, most urgent first. For each, say why it matters and give one concrete action the user could take in the roadmap (for example move a specific item, reassign part of a person's load, or break a dependency).`,
    '- When suggesting to move an item, only propose delaying it by at most its "slackDays". If slackDays is null the item has no dependents and can move freely; if it is 0 it cannot move without delaying others.',
    '- On a critical path, idle working days are waiting time between chained items, not a safety buffer to protect: pulling the next item forward would finish earlier. The wait may be deliberate, so phrase it as something to check rather than something to fix.',
    '- Free capacity ("idle_capacity", "unassigned_resources") is paid time nobody is scheduled to use. "relief"/"overloadedDuring" already excludes anyone whose role is known to differ, so when it lists overloaded people, the natural suggestion is to hand part of their work to the free person — call out "sameRole": true as a clean role match, and when it is false (role unknown on one side) frame it as needing a quick check rather than a sure fit. Never suggest reassigning work across two roles that are both known and different. Quote costs exactly as given, with their currencySymbol.',
    '- For "sprint_spillover" suggest starting the tasks earlier or splitting them; for "oversized_items" suggest splitting them into smaller deliverables.',
    '- A "time_off_conflict" is work assigned while the person is away (vacation, leave): nobody will do it on those days. Suggest reassigning that part to someone else or moving the item around the absence (within its slackDays); never suggest cancelling or shortening the time off.',
    '- You only suggest. Never claim that a change was made.',
    `- Write in ${locale === 'es' ? 'Spanish' : 'English'}. Be brief and concrete: "summary" is 2 to 3 sentences, "why" and "action" are one or two sentences each.`,
  ].join('\n')
}

function userPrompt(report: AnalysisReport): string {
  return JSON.stringify({
    summary: report.summary,
    findings: report.findings.slice(0, MAX_FINDINGS_SENT).map(f => ({
      id: f.id,
      kind: f.kind,
      severity: f.severity,
      title: f.title,
      evidence: f.evidence,
    })),
  })
}

function parseNarrative(raw: unknown, findingIds: Set<string>): Omit<Narrative, 'model'> {
  const bad = () => new LlmError('The model returned a reply with an unexpected shape.')
  if (!raw || typeof raw !== 'object') throw bad()
  const { summary, priorities } = raw as { summary?: unknown; priorities?: unknown }
  if (typeof summary !== 'string' || !summary.trim() || !Array.isArray(priorities)) throw bad()

  const valid: Narrative['priorities'] = []
  for (const p of priorities) {
    if (!p || typeof p !== 'object') continue
    const { findingId, why, action } = p as Record<string, unknown>
    if (typeof findingId !== 'string' || typeof why !== 'string' || typeof action !== 'string') continue
    // A model can cite an id that doesn't exist; those entries are dropped rather than shown.
    if (!findingIds.has(findingId)) continue
    valid.push({ findingId, why: why.trim(), action: action.trim() })
  }
  return { summary: summary.trim(), priorities: valid.slice(0, MAX_PRIORITIES) }
}

export async function narrate(report: AnalysisReport, llm: LlmClient, locale: Locale): Promise<Narrative> {
  const raw = await llm.completeJson({ system: systemPrompt(locale), user: userPrompt(report), schema: SCHEMA })
  const ids = new Set(report.findings.map(f => f.id))
  return { ...parseNarrative(raw, ids), model: llm.name }
}
