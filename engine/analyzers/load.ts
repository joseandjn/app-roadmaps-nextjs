import { isInstant } from '../domain.ts'
import type { AnalysisContext } from './context.ts'

export interface DayLoad {
  total: number
  byItem: Map<string, number>
}

export type Loads = Map<string, Map<number, DayLoad>>

// Assigned percentage per person and working day, from unfinished items that
// have a duration. Days before `todayDay` are left out: they are history.
export function buildLoads(ctx: AnalysisContext): Loads {
  const { snapshot, calendar, todayDay } = ctx
  const known = new Set(snapshot.resources.map(r => r.id))
  const loads: Loads = new Map()

  for (const it of snapshot.items) {
    if (it.status === 'Done' || isInstant(it) || it.dur <= 0) continue
    for (const a of it.assignments) {
      if (a.pct <= 0 || !known.has(a.r)) continue
      let days = loads.get(a.r)
      if (!days) loads.set(a.r, (days = new Map()))
      for (let d = it.startDay; d < it.startDay + it.dur; d++) {
        if (todayDay !== null && d < todayDay) continue
        if (!calendar.isWorking(d)) continue
        let load = days.get(d)
        if (!load) days.set(d, (load = { total: 0, byItem: new Map() }))
        load.total += a.pct
        load.byItem.set(it.id, (load.byItem.get(it.id) ?? 0) + a.pct)
      }
    }
  }
  return loads
}
