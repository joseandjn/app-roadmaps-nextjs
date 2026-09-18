import { analyzeIdle } from './analyzers/idle.ts'
import { analyzeOverload } from './analyzers/overload.ts'
import { analyzeSchedule } from './analyzers/schedule.ts'
import { analyzeSprints } from './analyzers/sprints.ts'
import { createCalendar } from './calendar.ts'
import type { Locale, RoadmapSnapshot } from './domain.ts'
import { rankFindings } from './findings.ts'
import type { Finding, Severity } from './findings.ts'

export interface AnalysisReport {
  generatedAt: string
  originDate: string
  summary: {
    itemCount: number
    resourceCount: number
    findingCount: number
    bySeverity: Record<Severity, number>
    overloadedResources: number
    // Cost of paid capacity with nothing scheduled; null when no resource has a rate.
    idleCost: number | null
    currencySymbol: string
  }
  findings: Finding[]
}

export interface AnalyzeOptions {
  originDate: string
  locale?: Locale
  todayDay?: number | null
}

function idleCost(idle: ReturnType<typeof analyzeIdle>): number | null {
  const costs = idle.map(f => (f.kind === 'idle_capacity' ? f.evidence.idleCost : f.evidence.totalIdleCost))
  return costs.some(c => c !== null) ? costs.reduce<number>((sum, c) => sum + (c ?? 0), 0) : null
}

// Deterministic analysis: everything here is computed, nothing is guessed, so
// the numbers can be trusted and reused by the LLM layer as ground truth.
export function analyzeRoadmap(snapshot: RoadmapSnapshot, options: AnalyzeOptions): AnalysisReport {
  const ctx = {
    snapshot,
    calendar: createCalendar(options.originDate, snapshot.settings),
    locale: options.locale ?? 'es',
    todayDay: options.todayDay ?? null,
  }

  const schedule = analyzeSchedule(ctx)
  const overload = analyzeOverload(ctx, schedule.slackByItem)
  const idle = analyzeIdle(ctx, overload)
  const findings = rankFindings([...schedule.findings, ...overload, ...idle, ...analyzeSprints(ctx)])

  const bySeverity: Record<Severity, number> = { high: 0, medium: 0, low: 0 }
  for (const f of findings) bySeverity[f.severity]++

  return {
    generatedAt: new Date().toISOString(),
    originDate: options.originDate,
    summary: {
      itemCount: snapshot.items.length,
      resourceCount: snapshot.resources.length,
      findingCount: findings.length,
      bySeverity,
      overloadedResources: new Set(overload.map(f => f.evidence.resourceId)).size,
      idleCost: idleCost(idle),
      currencySymbol: snapshot.settings.currencySymbol ?? '$',
    },
    findings,
  }
}
