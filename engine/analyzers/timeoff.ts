import type { TimeOffConflictFinding, Severity } from '../findings.ts'
import { timeOffText } from '../messages.ts'
import type { AnalysisContext } from './context.ts'
import type { Loads } from './load.ts'

// Severity by how much work falls on the absence (person-days, 1 = a full day at 100%).
function severityFor(personDays: number): Severity {
  if (personDays >= 5) return 'high'
  if (personDays >= 2) return 'medium'
  return 'low'
}

// Work assigned on working days a person is away. One finding per time-off
// entry that has any. Same scope as overload: working days only, unfinished
// items, nothing before `todayDay` (that's what `loads` already holds).
export function analyzeTimeOff(ctx: AnalysisContext, loads: Loads): TimeOffConflictFinding[] {
  const { snapshot, calendar, locale } = ctx
  const itemById = new Map(snapshot.items.map(i => [i.id, i]))
  const findings: TimeOffConflictFinding[] = []

  for (const resource of snapshot.resources) {
    const days = loads.get(resource.id)
    if (!days || !resource.timeOff?.length) continue
    // Overlapping entries: each day belongs to the first entry covering it.
    const claimed = new Set<number>()
    for (const off of [...resource.timeOff].sort((a, b) => a.startDay - b.startDay)) {
      const hit: number[] = []
      for (let d = off.startDay; d < off.startDay + off.dur; d++) {
        if (claimed.has(d)) continue
        claimed.add(d)
        if ((days.get(d)?.total ?? 0) > 0) hit.push(d)
      }
      if (!hit.length) continue

      const pctByItem = new Map<string, number>()
      let personDays = 0
      for (const d of hit) {
        const l = days.get(d)!
        personDays += l.total / 100
        for (const [id, pct] of l.byItem) pctByItem.set(id, Math.max(pctByItem.get(id) ?? 0, pct))
      }
      personDays = Math.round(personDays * 10) / 10
      const items = [...pctByItem.entries()]
        .map(([id, pct]) => { const it = itemById.get(id)!; return { id, title: it.title, projectId: it.projectId, pct } })
        .sort((a, b) => b.pct - a.pct || a.title.localeCompare(b.title))

      const startDay = hit[0], endDay = hit[hit.length - 1]
      const startDate = calendar.toIso(startDay), endDate = calendar.toIso(endDay)
      const timeOffStartDate = calendar.toIso(off.startDay), timeOffEndDate = calendar.toIso(off.startDay + off.dur - 1)
      findings.push({
        id: `time_off_conflict:${resource.id}:${off.startDay}-${off.startDay + off.dur}`,
        kind: 'time_off_conflict',
        severity: severityFor(personDays),
        score: personDays,
        ...timeOffText(locale, { name: resource.name, note: off.note ?? null, offStart: timeOffStartDate, offEnd: timeOffEndDate, start: startDate, end: endDate, days: hit.length, personDays, items }),
        evidence: {
          resourceId: resource.id,
          resourceName: resource.name,
          timeOffStartDate,
          timeOffEndDate,
          note: off.note ?? null,
          startDay,
          endDay,
          startDate,
          endDate,
          workingDays: hit.length,
          personDays,
          items,
        },
      })
    }
  }
  return findings
}
