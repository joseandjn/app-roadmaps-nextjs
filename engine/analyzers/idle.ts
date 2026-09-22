import { dailyRate, fmtMoney } from '../cost.ts'
import { capacityPct, isInstant, itemEnd } from '../domain.ts'
import type { EngineItem, EngineResource } from '../domain.ts'
import type { IdleCapacityFinding, ItemRef, OverloadFinding, Severity, UnassignedResourcesFinding } from '../findings.ts'
import { idleText, unassignedText } from '../messages.ts'
import type { AnalysisContext } from './context.ts'
import { buildLoads } from './load.ts'

const MIN_IDLE_WORKING_DAYS = 5
const LONG_IDLE_WORKING_DAYS = 15
const MAX_RELIEF = 3

const ref = (i: EngineItem): ItemRef => ({ id: i.id, title: i.title, projectId: i.projectId })

// Finds paid capacity nobody is scheduled to use, in two shapes:
//  - a 'gap': a run of working days between two pieces of one person's work
//    (time after someone's last item is not reported: they would simply take new work);
//  - everyone with no unfinished work at all, grouped into a single finding.
// Both are cross-checked against the overload findings, so free people during
// someone else's overload stand out. Idle cost counts only the share of a
// person's rate that is available to this roadmap (their availability), and
// people with 0% availability are never reported as idle.
export function analyzeIdle(ctx: AnalysisContext, overloads: OverloadFinding[]): Array<IdleCapacityFinding | UnassignedResourcesFinding> {
  const { snapshot, calendar, locale, todayDay } = ctx
  const symbol = snapshot.settings.currencySymbol ?? '$'
  const active = snapshot.items.filter(i => i.status !== 'Done' && !isInstant(i) && i.dur > 0)
  if (active.length === 0) return []

  const from = todayDay ?? Math.min(...active.map(i => i.startDay))
  const horizonEnd = Math.max(...active.map(itemEnd))
  const itemById = new Map(snapshot.items.map(i => [i.id, i]))
  const resourceById = new Map(snapshot.resources.map(r => [r.id, r]))
  const loads = buildLoads(ctx)

  const countWorking = (start: number, endExclusive: number) => {
    let n = 0
    for (let d = start; d < endExclusive; d++) if (calendar.isWorking(d)) n++
    return n
  }
  const firstWorkingFrom = (d: number) => { while (!calendar.isWorking(d)) d++; return d }
  const lastWorkingBefore = (d: number) => { d--; while (!calendar.isWorking(d)) d--; return d }

  // Overloaded people (other than `except`) whose overload overlaps [startDay, endDay], plus
  // the roles the overloaded window's own items call for (empty when none declare one).
  const overloadedDuring = (startDay: number, endDay: number, except: string | null) =>
    overloads
      .filter(o => o.evidence.resourceId !== except)
      .map(o => ({
        resourceId: o.evidence.resourceId,
        resourceName: o.evidence.resourceName,
        resourceRole: resourceById.get(o.evidence.resourceId)?.role,
        overlapWorkingDays: countWorking(Math.max(startDay, o.evidence.startDay), Math.min(endDay, o.evidence.endDay) + 1),
        overloadFindingId: o.id,
        requiredRoles: [...new Set(o.evidence.items.map(i => i.requiredRole).filter((r): r is string => r !== null))],
      }))
      .filter(o => o.overlapWorkingDays > 0)

  // Whether a candidate can be ruled out for this overloaded window. When at least one of the
  // window's items declares a required role, that's ground truth: only a real mismatch against
  // those roles counts, and a candidate with no role recorded stays permissive (nothing to rule
  // out). With no item-level role at all — the common case while this field is new — fall back
  // to comparing against the overloaded person's own role, the closest guess without better data.
  const rolesConflict = (candidateRole: string | undefined, overloadedRole: string | undefined, requiredRoles: string[]): boolean =>
    requiredRoles.length > 0
      ? candidateRole !== undefined && !requiredRoles.includes(candidateRole)
      : candidateRole !== undefined && overloadedRole !== undefined && candidateRole !== overloadedRole

  // "Clean match" flag shown in the finding text: role confirmed against the task(s) themselves
  // when we have that, else confirmed only against the overloaded person's own role.
  const sameRole = (candidateRole: string | undefined, overloadedRole: string | undefined, requiredRoles: string[]): boolean =>
    requiredRoles.length > 0
      ? candidateRole !== undefined && requiredRoles.includes(candidateRole)
      : candidateRole !== undefined && overloadedRole !== undefined && candidateRole === overloadedRole

  const findings: Array<IdleCapacityFinding | UnassignedResourcesFinding> = []
  const unassigned: EngineResource[] = []

  // Rate attributable to this roadmap: the person's rate scaled by availability.
  const availableRate = (r: EngineResource) => {
    const rate = dailyRate(r, snapshot.settings)
    return rate === null ? null : rate * capacityPct(r) / 100
  }

  for (const resource of snapshot.resources) {
    if (capacityPct(resource) <= 0) continue
    const days = loads.get(resource.id)
    const busy = days ? [...days.entries()].filter(([, l]) => l.total > 0).map(([d]) => d).sort((a, b) => a - b) : []
    if (!days || busy.length === 0) { unassigned.push(resource); continue }
    const rate = availableRate(resource)

    const pick = (day: number, compare: (a: EngineItem, b: EngineItem) => number): EngineItem =>
      [...days.get(day)!.byItem.keys()].map(id => itemById.get(id)!).sort((a, b) => compare(a, b) || a.id.localeCompare(b.id))[0]

    for (let i = 0; i < busy.length - 1; i++) {
      const idleWorkingDays = countWorking(busy[i] + 1, busy[i + 1])
      if (idleWorkingDays < MIN_IDLE_WORKING_DAYS) continue

      const startDay = firstWorkingFrom(busy[i] + 1)
      const endDay = lastWorkingBefore(busy[i + 1])
      const beforeItem = pick(busy[i], (a, b) => itemEnd(b) - itemEnd(a))
      const afterItem = pick(busy[i + 1], (a, b) => a.startDay - b.startDay)
      const relief = overloadedDuring(startDay, endDay, resource.id)
        .filter(o => !rolesConflict(resource.role, o.resourceRole, o.requiredRoles))
        .map(o => ({
          resourceId: o.resourceId,
          resourceName: o.resourceName,
          overlapWorkingDays: o.overlapWorkingDays,
          overloadFindingId: o.overloadFindingId,
          sameRole: sameRole(resource.role, o.resourceRole, o.requiredRoles),
        }))
        .sort((a, b) => Number(b.sameRole) - Number(a.sameRole) || b.overlapWorkingDays - a.overlapWorkingDays || a.resourceName.localeCompare(b.resourceName))
        .slice(0, MAX_RELIEF)
      const idleCost = rate === null ? null : rate * idleWorkingDays
      const startDate = calendar.toIso(startDay)
      const endDate = calendar.toIso(endDay)
      const severity: Severity = relief.length > 0 || idleWorkingDays >= LONG_IDLE_WORKING_DAYS ? 'medium' : 'low'

      findings.push({
        id: `idle_capacity:${resource.id}:${startDay}-${endDay}`,
        kind: 'idle_capacity',
        severity,
        score: idleWorkingDays,
        ...idleText(locale, {
          name: resource.name,
          start: startDate,
          end: endDate,
          days: idleWorkingDays,
          cost: idleCost === null ? null : fmtMoney(idleCost, symbol),
          before: beforeItem.title,
          after: afterItem.title,
          relief: relief.map(r => ({ name: r.resourceName, sameRole: r.sameRole })),
        }),
        evidence: {
          resourceId: resource.id,
          resourceName: resource.name,
          role: resource.role ?? null,
          startDay,
          endDay,
          startDate,
          endDate,
          idleWorkingDays,
          idleCost: idleCost === null ? null : Math.round(idleCost),
          currencySymbol: symbol,
          beforeItem: ref(beforeItem),
          afterItem: ref(afterItem),
          relief,
        },
      })
    }
  }

  const workingDays = countWorking(from, horizonEnd)
  if (unassigned.length > 0 && workingDays >= MIN_IDLE_WORKING_DAYS) {
    const startDay = firstWorkingFrom(from)
    const endDay = lastWorkingBefore(horizonEnd)
    const people = unassigned
      .map(r => {
        const rate = availableRate(r)
        return { resourceId: r.id, resourceName: r.name, role: r.role ?? null, idleCost: rate === null ? null : Math.round(rate * workingDays) }
      })
      .sort((a, b) => (b.idleCost ?? 0) - (a.idleCost ?? 0) || a.resourceName.localeCompare(b.resourceName))
    const totalIdleCost = people.some(p => p.idleCost !== null) ? people.reduce((sum, p) => sum + (p.idleCost ?? 0), 0) : null
    // Only cite an overloaded person here if at least one idle person could plausibly cover
    // for them — same reasoning as the per-person relief filter above.
    const overloaded = overloadedDuring(startDay, endDay, null)
      .filter(o => unassigned.some(u => !rolesConflict(u.role, o.resourceRole, o.requiredRoles)))
      .sort((a, b) => b.overlapWorkingDays - a.overlapWorkingDays || a.resourceName.localeCompare(b.resourceName))
      .slice(0, MAX_RELIEF)
      .map(({ resourceId, resourceName, overlapWorkingDays, overloadFindingId }) => ({ resourceId, resourceName, overlapWorkingDays, overloadFindingId }))
    const startDate = calendar.toIso(startDay)
    const endDate = calendar.toIso(endDay)

    findings.push({
      id: 'unassigned_resources',
      kind: 'unassigned_resources',
      severity: overloaded.length > 0 ? 'medium' : 'low',
      score: totalIdleCost ?? people.length,
      ...unassignedText(locale, {
        names: people.map(p => p.resourceName),
        start: startDate,
        end: endDate,
        days: workingDays,
        cost: totalIdleCost === null ? null : fmtMoney(totalIdleCost, symbol),
        overloaded: overloaded.map(o => o.resourceName),
      }),
      evidence: { startDate, endDate, workingDays, people, totalIdleCost, currencySymbol: symbol, overloadedDuring: overloaded },
    })
  }

  return findings
}
