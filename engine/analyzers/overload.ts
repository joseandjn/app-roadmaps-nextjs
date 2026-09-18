import type { OverloadFinding, Severity } from '../findings.ts'
import { overloadText } from '../messages.ts'
import type { AnalysisContext } from './context.ts'
import { buildLoads } from './load.ts'
import type { DayLoad } from './load.ts'

const CAPACITY_PCT = 100

function severityFor(peakPct: number, excessPersonDays: number): Severity {
  if (peakPct >= 150 || excessPersonDays >= 5) return 'high'
  if (peakPct >= 125 || excessPersonDays >= 1.5) return 'medium'
  return 'low'
}

// Finds stretches where a person's concurrent assignments exceed 100%.
// Only working days count (weekends/holidays per settings), finished items
// are ignored, and so is anything before `todayDay`.
export function analyzeOverload(ctx: AnalysisContext, slackByItem: Map<string, number>): OverloadFinding[] {
  const { snapshot, calendar, locale } = ctx
  const itemById = new Map(snapshot.items.map(i => [i.id, i]))
  const resources = new Map(snapshot.resources.map(r => [r.id, r]))
  const loads = buildLoads(ctx)

  const hasWorkingDayBetween = (from: number, to: number) => {
    for (let d = from + 1; d < to; d++) if (calendar.isWorking(d)) return true
    return false
  }

  const findings: OverloadFinding[] = []
  for (const [rid, days] of loads) {
    const resource = resources.get(rid)!
    const overloaded = [...days.entries()].filter(([, l]) => l.total > CAPACITY_PCT).sort((a, b) => a[0] - b[0])

    const windows: Array<Array<[number, DayLoad]>> = []
    for (const entry of overloaded) {
      const current = windows[windows.length - 1]
      if (current && !hasWorkingDayBetween(current[current.length - 1][0], entry[0])) current.push(entry)
      else windows.push([entry])
    }

    for (const win of windows) {
      const startDay = win[0][0]
      const endDay = win[win.length - 1][0]
      const peakPct = Math.max(...win.map(([, l]) => l.total))
      const excessPersonDays = Math.round(win.reduce((sum, [, l]) => sum + (l.total - CAPACITY_PCT) / 100, 0) * 10) / 10

      const pctByItem = new Map<string, number>()
      for (const [, l] of win) for (const [id, pct] of l.byItem) pctByItem.set(id, Math.max(pctByItem.get(id) ?? 0, pct))
      const items = [...pctByItem.entries()]
        .map(([id, pct]) => {
          const it = itemById.get(id)!
          return { id, title: it.title, projectId: it.projectId, pct, slackDays: slackByItem.get(id) ?? null }
        })
        .sort((a, b) => b.pct - a.pct || a.title.localeCompare(b.title))

      const startDate = calendar.toIso(startDay)
      const endDate = calendar.toIso(endDay)
      findings.push({
        id: `overload:${rid}:${startDay}-${endDay}`,
        kind: 'overload',
        severity: severityFor(peakPct, excessPersonDays),
        score: excessPersonDays,
        ...overloadText(locale, { name: resource.name, peakPct, start: startDate, end: endDate, days: win.length, excess: excessPersonDays, items }),
        evidence: {
          resourceId: rid,
          resourceName: resource.name,
          startDay,
          endDay,
          startDate,
          endDate,
          workingDays: win.length,
          peakPct,
          excessPersonDays,
          items,
        },
      })
    }
  }
  return findings
}
