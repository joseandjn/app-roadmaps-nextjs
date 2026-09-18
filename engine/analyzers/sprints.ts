import type { Finding, ItemRef, OversizedItemsFinding, Severity, SprintSpilloverFinding } from '../findings.ts'
import { oversizedText, spilloverText } from '../messages.ts'
import type { AnalysisContext } from './context.ts'

const severityFor = (count: number): Severity => (count >= 3 ? 'medium' : 'low')

// Sprint fit for tasks (epics are containers and milestones are instants, so
// they are exempt): a task that would fit in one sprint but straddles a
// boundary, and a task longer than the sprint it starts in, which can never
// fit. Sprints already over are ignored.
export function analyzeSprints(ctx: AnalysisContext): Finding[] {
  const { snapshot, calendar, locale, todayDay } = ctx
  const sprints = (snapshot.sprints ?? []).filter(s => s.dur > 0).sort((a, b) => a.startDay - b.startDay)
  if (sprints.length === 0) return []

  const ref = (i: { id: string; title: string; projectId: string }): ItemRef => ({ id: i.id, title: i.title, projectId: i.projectId })
  const spillover = new Map<string, SprintSpilloverFinding['evidence']['items']>()
  const oversized: OversizedItemsFinding['evidence']['items'] = []

  for (const it of snapshot.items) {
    if (it.type !== 'task' || it.status === 'Done' || it.dur <= 0) continue
    const sprint = sprints.find(s => it.startDay >= s.startDay && it.startDay < s.startDay + s.dur)
    if (!sprint) continue
    const sprintEnd = sprint.startDay + sprint.dur
    const end = it.startDay + it.dur
    if (end <= sprintEnd || (todayDay !== null && sprintEnd <= todayDay)) continue

    if (it.dur > sprint.dur) {
      oversized.push({ ...ref(it), dur: it.dur, sprintName: sprint.name, sprintDur: sprint.dur })
    } else {
      const list = spillover.get(sprint.id) ?? []
      list.push({ ...ref(it), startDate: calendar.toIso(it.startDay), endDate: calendar.toIso(end), spillDays: end - sprintEnd })
      spillover.set(sprint.id, list)
    }
  }

  const findings: Finding[] = []
  for (const sprint of sprints) {
    const items = spillover.get(sprint.id)
    if (!items) continue
    items.sort((a, b) => b.spillDays - a.spillDays || a.title.localeCompare(b.title))
    findings.push({
      id: `sprint_spillover:${sprint.id}`,
      kind: 'sprint_spillover',
      severity: severityFor(items.length),
      score: items.length,
      ...spilloverText(locale, { sprint: sprint.name, items }),
      evidence: {
        sprintId: sprint.id,
        sprintName: sprint.name,
        sprintStartDate: calendar.toIso(sprint.startDay),
        sprintEndDate: calendar.toIso(sprint.startDay + sprint.dur),
        items,
      },
    })
  }

  if (oversized.length > 0) {
    oversized.sort((a, b) => b.dur - a.dur || a.title.localeCompare(b.title))
    findings.push({
      id: 'oversized_items',
      kind: 'oversized_items',
      severity: severityFor(oversized.length),
      score: oversized.length,
      ...oversizedText(locale, { items: oversized }),
      evidence: { items: oversized },
    })
  }
  return findings
}
