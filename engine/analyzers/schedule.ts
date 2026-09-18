import { itemEnd } from '../domain.ts'
import type { EngineItem } from '../domain.ts'
import type { CriticalPathFinding, DependencyConflictFinding, DependencyCycleFinding, Finding, ItemRef, Severity } from '../findings.ts'
import { conflictText, criticalPathText, cycleText } from '../messages.ts'
import type { AnalysisContext } from './context.ts'

const IDLE_MEDIUM_WORKING_DAYS = 5

export interface ScheduleResult {
  findings: Finding[]
  // For every item that has dependents: calendar days it can slip before it
  // collides with the earliest of them. Items without dependents are absent.
  slackByItem: Map<string, number>
}

interface Edge { from: string; to: string }

const ref = (i: EngineItem): ItemRef => ({ id: i.id, title: i.title, projectId: i.projectId })

function findCycles(nodes: string[], adj: Map<string, string[]>): string[][] {
  let index = 0
  const idx = new Map<string, number>()
  const low = new Map<string, number>()
  const onStack = new Set<string>()
  const stack: string[] = []
  const cycles: string[][] = []

  const visit = (v: string) => {
    idx.set(v, index)
    low.set(v, index)
    index++
    stack.push(v)
    onStack.add(v)
    for (const w of adj.get(v) ?? []) {
      if (!idx.has(w)) {
        visit(w)
        low.set(v, Math.min(low.get(v)!, low.get(w)!))
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v)!, idx.get(w)!))
      }
    }
    if (low.get(v) === idx.get(v)) {
      const comp: string[] = []
      let w: string
      do {
        w = stack.pop()!
        onStack.delete(w)
        comp.push(w)
      } while (w !== v)
      if (comp.length > 1) cycles.push(comp)
    }
  }

  for (const v of nodes) if (!idx.has(v)) visit(v)
  return cycles
}

function conflictSeverity(overlapDays: number): Severity {
  return overlapDays >= 10 ? 'high' : overlapDays >= 3 ? 'medium' : 'low'
}

// Dependency findings, judged against the dates as planned (what the user sees
// on the timeline), not against a recomputed ideal schedule:
//  - conflicts: a dependent starts before what it waits on ends;
//  - cycles: items that wait on each other;
//  - critical path: per group of linked items, the chain of dependencies that
//    leads to the item finishing last, with the idle working days between links.
export function analyzeSchedule(ctx: AnalysisContext): ScheduleResult {
  const { snapshot, calendar, locale, todayDay } = ctx
  const active = new Map(snapshot.items.filter(i => i.status !== 'Done').map(i => [i.id, i]))
  const projectName = new Map(snapshot.projects.map(p => [p.id, p.name]))
  const findings: Finding[] = []
  const slackByItem = new Map<string, number>()

  const seen = new Set<string>()
  const edges: Edge[] = []
  for (const e of snapshot.deps) {
    const key = `${e.from}>${e.to}`
    if (e.from === e.to || !active.has(e.from) || !active.has(e.to) || seen.has(key)) continue
    seen.add(key)
    edges.push({ from: e.from, to: e.to })
  }

  for (const e of edges) {
    const succ = active.get(e.from)!
    const pred = active.get(e.to)!
    const overlapDays = itemEnd(pred) - succ.startDay
    if (overlapDays <= 0) continue
    const predEndDate = calendar.toIso(itemEnd(pred))
    const succStartDate = calendar.toIso(succ.startDay)
    const finding: DependencyConflictFinding = {
      id: `dependency_conflict:${succ.id}>${pred.id}`,
      kind: 'dependency_conflict',
      severity: conflictSeverity(overlapDays),
      score: overlapDays,
      ...conflictText(locale, { predecessor: pred.title, successor: succ.title, overlapDays, predEnd: predEndDate, succStart: succStartDate }),
      evidence: {
        predecessor: { ...ref(pred), endDay: itemEnd(pred), endDate: predEndDate },
        successor: { ...ref(succ), startDay: succ.startDay, startDate: succStartDate },
        overlapDays,
      },
    }
    findings.push(finding)
  }

  const adjacency = new Map<string, string[]>()
  for (const e of edges) adjacency.set(e.from, [...(adjacency.get(e.from) ?? []), e.to])
  const inCycle = new Set<string>()
  for (const cycle of findCycles([...active.keys()], adjacency)) {
    cycle.forEach(id => inCycle.add(id))
    const members = cycle.map(id => active.get(id)!).sort((a, b) => a.startDay - b.startDay || a.id.localeCompare(b.id))
    const finding: DependencyCycleFinding = {
      id: `dependency_cycle:${members.map(m => m.id).join('+')}`,
      kind: 'dependency_cycle',
      severity: 'high',
      score: members.length,
      ...cycleText(locale, { titles: members.map(m => m.title) }),
      evidence: { items: members.map(ref) },
    }
    findings.push(finding)
  }

  const dagEdges = edges.filter(e => !inCycle.has(e.from) && !inCycle.has(e.to))
  const preds = new Map<string, string[]>()
  const succs = new Map<string, string[]>()
  for (const e of dagEdges) {
    preds.set(e.from, [...(preds.get(e.from) ?? []), e.to])
    succs.set(e.to, [...(succs.get(e.to) ?? []), e.from])
  }

  for (const [id, next] of succs) {
    const it = active.get(id)!
    slackByItem.set(id, Math.max(0, Math.min(...next.map(s => active.get(s)!.startDay - itemEnd(it)))))
  }

  const workingDaysBetween = (from: number, to: number) => {
    let n = 0
    for (let d = from; d < to; d++) if (calendar.isWorking(d)) n++
    return n
  }

  const visited = new Set<string>()
  for (const start of new Set(dagEdges.flatMap(e => [e.from, e.to]))) {
    if (visited.has(start)) continue
    const component: string[] = []
    const queue = [start]
    visited.add(start)
    while (queue.length) {
      const v = queue.pop()!
      component.push(v)
      for (const w of [...(preds.get(v) ?? []), ...(succs.get(v) ?? [])]) {
        if (!visited.has(w)) { visited.add(w); queue.push(w) }
      }
    }
    findings.push(criticalPath(component))
  }

  function criticalPath(component: string[]): CriticalPathFinding {
    const item = (id: string) => active.get(id)!
    const latest = (ids: string[]) =>
      [...ids].sort((a, b) => itemEnd(item(b)) - itemEnd(item(a)) || item(b).startDay - item(a).startDay || a.localeCompare(b))[0]

    // Walk back from the item that finishes last, always through the
    // predecessor that finishes last: the one that actually gates the next link.
    const chainIds: string[] = []
    for (let cur: string | undefined = latest(component); cur; cur = (preds.get(cur) ?? []).length ? latest(preds.get(cur)!) : undefined) {
      chainIds.unshift(cur)
    }

    const chain = chainIds.map((id, i) => {
      const it = item(id)
      const prev = i > 0 ? item(chainIds[i - 1]) : null
      const gap = prev ? it.startDay - itemEnd(prev) : null
      return {
        ...ref(it),
        startDay: it.startDay,
        endDay: itemEnd(it),
        startDate: calendar.toIso(it.startDay),
        endDate: calendar.toIso(itemEnd(it)),
        status: it.status,
        gapBeforeDays: gap,
        idleWorkingDaysBefore: prev && gap !== null && gap > 0 ? workingDaysBetween(itemEnd(prev), it.startDay) : prev ? 0 : null,
      }
    })

    const idleWorkingDays = chain.reduce((sum, c) => sum + (c.idleWorkingDaysBefore ?? 0), 0)
    const hasConflict = chain.some(c => c.gapBeforeDays !== null && c.gapBeforeDays < 0)
    const atRiskCount = chainIds.filter(id => item(id).status === 'At Risk').length
    const overdueCount = todayDay === null ? 0 : chainIds.filter(id => itemEnd(item(id)) < todayDay).length
    const spanDays = chain[chain.length - 1].endDay - chain[0].startDay
    const projectIds = [...new Set(chain.map(c => c.projectId))]
    const severity: Severity =
      atRiskCount > 0 || overdueCount > 0 ? 'high' : hasConflict || idleWorkingDays >= IDLE_MEDIUM_WORKING_DAYS ? 'medium' : 'low'

    return {
      id: `critical_path:${chainIds[0]}>${chainIds[chainIds.length - 1]}`,
      kind: 'critical_path',
      severity,
      score: spanDays,
      ...criticalPathText(locale, {
        projects: projectIds.map(id => projectName.get(id) ?? id),
        chain: chain.map(c => ({ title: c.title, idleBefore: c.idleWorkingDaysBefore })),
        end: chain[chain.length - 1].endDate,
        spanDays,
        idleWorkingDays,
        hasConflict,
        atRisk: atRiskCount,
        overdue: overdueCount,
      }),
      evidence: {
        chain,
        startDate: chain[0].startDate,
        endDate: chain[chain.length - 1].endDate,
        spanDays,
        idleWorkingDays,
        atRiskCount,
        overdueCount,
        projectIds,
      },
    }
  }

  return { findings, slackByItem }
}
