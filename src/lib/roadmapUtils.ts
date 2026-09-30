import { START_DATE, TOTAL_DAYS, DEFAULT_PROJECT_TASKS, CATEGORIES } from '@/data/initialData'
import { formatDate, formatMonthDay, monthShort, weekdayShort, quarterLabel } from '@/lib/dateFormat'
import { layoutLanes, type LaneLayout } from '@/lib/lanes'
import type { Item, Resource, Dependency, ScaleIndex, Settings, ScenarioMetrics, TimeOff, Sprint } from '@/types'

export const DAY_MS = 86400000

// Milestones/releases are instants on the timeline — their `dur` should
// always be 0, but treat the type as authoritative rather than trusting a
// stored `dur` (e.g. data edited before this was enforced), so a stray
// duration can't make an instant item behave like a multi-day span.
export function isInstantItem(it: Item): boolean {
  return it.type === 'milestone' || it.type === 'release'
}

// End day for scheduling comparisons (clash/dependency checks) — an instant
// item "ends" the moment it starts, regardless of any stored `dur`.
export function itemEnd(it: Item): number {
  return isInstantItem(it) ? it.startDay : it.startDay + it.dur
}

// The task titles a new project starts with (Settings → General), blanks dropped.
// Categories to offer: the catalog (or the built-in list), plus any a project
// uses that isn't in it (e.g. from older data), so none ever goes missing.
export function projectCategories(settings: Pick<Settings, 'categories'>, projects: { category: string }[] = []): string[] {
  const list = [...(settings.categories ?? CATEGORIES)]
  for (const p of projects) if (p.category && !list.includes(p.category)) list.push(p.category)
  return list
}

// How long a new item of this type starts out: the plan's setting, or 21
// calendar days. Instants (milestone, release) are 0.
export const DEFAULT_ITEM_DAYS = 21
export function defaultDuration(settings: Pick<Settings, 'defaultDurations'>, type: Item['type']): number {
  if (type === 'milestone' || type === 'release') return 0
  const v = settings.defaultDurations?.[type]
  return v && v >= 1 ? Math.round(v) : DEFAULT_ITEM_DAYS
}

export function projectTaskTemplate(settings: Settings): string[] {
  return (settings.defaultProjectTasks ?? DEFAULT_PROJECT_TASKS).map(t => t.trim()).filter(Boolean)
}

// Room past the last planned day, so there's always space to add future work.
export const PLAN_BUFFER_DAYS = 180

// Where the views end when no end date is set: past the last item, sprint,
// today and `startDay` (a jump to a later date), plus the buffer. Grows with
// the plan, so planning further ahead just means adding the work there.
export function planEnd(items: Item[], sprints: Sprint[], todayDay: number | null, startDay: number | null): number {
  let last = Math.max(0, todayDay ?? 0, startDay ?? 0)
  for (const it of items) last = Math.max(last, it.startDay + it.dur)
  for (const sp of sprints) last = Math.max(last, sp.startDay + sp.dur)
  return last + PLAN_BUFFER_DAYS
}

export function deriveScale(ppd: number): ScaleIndex {
  if (ppd >= 30) return 0
  if (ppd >= 11) return 1
  if (ppd >= 4) return 2
  return 3
}

export function addDays(n: number): Date {
  return new Date(START_DATE.getTime() + n * DAY_MS)
}

// In the app's language and the date format picked in Preferences (see dateFormat.ts).
export function fmtDate(d: Date): string {
  return formatDate(d)
}

export function dateStr(off: number): string {
  const d = addDays(off)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function offFromStr(s: string): number {
  const p = s.split('-')
  return Math.round((new Date(+p[0], +p[1] - 1, +p[2]).getTime() - START_DATE.getTime()) / DAY_MS)
}

export function isWorkingDay(dayOffset: number, settings: Settings): boolean {
  const d = addDays(dayOffset)
  if (!settings.countWeekends && (d.getDay() === 0 || d.getDay() === 6)) return false
  if (settings.holidays.includes(dateStr(dayOffset))) return false
  return true
}

export function workingDaysInRange(startDay: number, dur: number, settings: Settings): number {
  let n = 0
  for (let i = 0; i < dur; i++) if (isWorkingDay(startDay + i, settings)) n++
  return n
}

export function initials(name: string): string {
  const p = name.split(' ')
  return ((p[0][0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase()
}

export function allocColor(pct: number) {
  if (pct <= 0) return { bg: '#fbfbfc', fg: '#d4d4d8', bd: '#f4f4f5' }
  if (pct < 50) return { bg: '#eef3fc', fg: '#5b7fc4', bd: '#e3ebf9' }
  if (pct < 85) return { bg: '#d9e6fb', fg: '#2f5db0', bd: '#c8dafa' }
  if (pct <= 100) return { bg: '#bcd2f7', fg: '#1d4ed8', bd: '#a9c6f5' }
  return { bg: '#f6e2c6', fg: '#9a5b00', bd: '#eecfa3' }
}

// A monthly Resource.cost is a calendar-month rate — this is the calendar-
// month average used to prorate it into a daily rate for cost-in-range
// calculations. An hourly rate is prorated using settings.workHoursPerDay
// instead (see resourceDailyRate).
export const AVG_DAYS_PER_MONTH = 30.44

// A resource's cost expressed as a per-working-day rate, regardless of
// whether it's entered as a monthly or hourly rate.
export function resourceDailyRate(r: Resource, settings: Settings): number {
  return r.costUnit === 'hour' ? r.cost * settings.workHoursPerDay : r.cost / AVG_DAYS_PER_MONTH
}

// Cost of one item's assignments, prorated to the working days (per
// settings.countWeekends/holidays) of its duration that overlap
// [rangeStart, rangeEnd). Milestones/releases (dur 0) never carry cost.
// With settings.timeOffReducesCost, each person's time-off days are left out.
export function itemCostInRange(it: Item, resources: Resource[], rangeStart: number, rangeEnd: number, settings: Settings): number {
  return assignmentCostsInRange(it, resources, rangeStart, rangeEnd, settings).reduce((sum, c) => sum + c.cost, 0)
}

// Same proration as itemCostInRange, split per assigned resource.
export function assignmentCostsInRange(it: Item, resources: Resource[], rangeStart: number, rangeEnd: number, settings: Settings): { rid: string; cost: number }[] {
  if (isInstantItem(it) || it.dur <= 0) return []
  const s = Math.max(it.startDay, rangeStart)
  const e = Math.min(it.startDay + it.dur, rangeEnd)
  if (e <= s) return []
  const days = workingDaysInRange(s, e - s, settings)
  if (days <= 0) return []
  const out: { rid: string; cost: number }[] = []
  for (const a of it.assignments) {
    const r = resources.find(rr => rr.id === a.r)
    if (!r) continue
    const paid = settings.timeOffReducesCost ? days - timeOffWorkingDays(r, s, e, settings) : days
    out.push({ rid: r.id, cost: resourceDailyRate(r, settings) * (a.pct / 100) * paid })
  }
  return out
}

export function fmtSigned(n: number, fmt: (n: number) => string): string {
  return n === 0 ? fmt(0) : (n > 0 ? '+' : '−') + fmt(Math.abs(n))
}

export function fmtMoney(n: number, symbol = '$'): string {
  return symbol + Math.round(n).toLocaleString('en-US')
}

export type { LanePlacement as PackedItem } from '@/lib/lanes'

// Rows of one project's items: saved lanes first, then the first free row.
export function pack(list: Item[], ppd: number): LaneLayout {
  return layoutLanes(list, ppd)
}

// How much of a person's time is available for this roadmap (100 unless set lower).
export function resourceCapacity(r: Pick<Resource, 'availability'>): number {
  return r.availability ?? 100
}

// A load (assigned %) as a share of the person's own capacity: 100 means exactly
// at their availability. Colors and "full/overallocated" tags read this, so a
// person available 50% is "full" at 50% assigned.
export function utilizationPct(load: number, r: Pick<Resource, 'availability'>): number {
  const cap = resourceCapacity(r)
  return cap > 0 ? (load / cap) * 100 : load > 0 ? Infinity : 0
}

export function isOverloaded(load: number, r: Pick<Resource, 'availability'>): boolean {
  return load > resourceCapacity(r)
}

// The time-off entry covering this day, if the person is away.
export function timeOffOn(r: Pick<Resource, 'timeOff'>, day: number): TimeOff | undefined {
  return r.timeOff?.find(o => day >= o.startDay && day < o.startDay + o.dur)
}

// Capacity on a given day: 0 while away, otherwise their availability.
export function capacityOn(r: Pick<Resource, 'availability' | 'timeOff'>, day: number): number {
  return timeOffOn(r, day) ? 0 : resourceCapacity(r)
}

// Working days in [from, to) the person is away (overlapping entries count
// each day once).
export function timeOffWorkingDays(r: Pick<Resource, 'timeOff'>, from: number, to: number, settings: Settings): number {
  const days = new Set<number>()
  for (const o of r.timeOff ?? []) {
    const e = Math.min(o.startDay + o.dur, to)
    for (let d = Math.max(o.startDay, from); d < e; d++) if (isWorkingDay(d, settings)) days.add(d)
  }
  return days.size
}

// Working days the item has this person assigned while they're away,
// optionally only within [from, to). Instants carry no work, so never count.
export function assignedDuringTimeOff(it: Item, r: Pick<Resource, 'id' | 'timeOff'>, settings: Settings, from = -Infinity, to = Infinity): number {
  if (isInstantItem(it) || it.dur <= 0 || !r.timeOff?.length) return 0
  if (!it.assignments.some(a => a.r === r.id && a.pct > 0)) return 0
  return timeOffWorkingDays(r, Math.max(it.startDay, from), Math.min(it.startDay + it.dur, to), settings)
}

// Whether two lists of time off are the same, regardless of order (ids
// aside). Used to tell whether a person's absences changed between scenarios.
export function sameTimeOff(a: TimeOff[] = [], b: TimeOff[] = []): boolean {
  const key = (o: TimeOff) => `${o.startDay}|${o.dur}|${o.note ?? ''}`
  const ka = a.map(key).sort(), kb = b.map(key).sort()
  return ka.length === kb.length && ka.every((k, i) => k === kb[i])
}

// Peak concurrent allocation % for a resource, day by day. Bucketing by a
// fixed-origin 7-day window (the previous approach) overcounted: two items
// that don't actually share a single day but both touch the same window —
// e.g. one ending Tuesday, the next starting Thursday of that window — would
// sum their percentages and read as over-allocated despite no real overlap.
export function resPeak(rid: string, items: Item[]): number {
  const daily: Record<number, number> = {}
  let peak = 0
  for (const it of items) {
    if (isInstantItem(it) || it.dur <= 0) continue
    for (const as of it.assignments) {
      if (as.r !== rid) continue
      for (let d = it.startDay; d < it.startDay + it.dur; d++) {
        const v = (daily[d] ?? 0) + as.pct
        daily[d] = v
        if (v > peak) peak = v
      }
    }
  }
  return peak
}

// Dependency problems: edges on a cycle (as "from>to" keys, used to color
// arrows) and every item on either end of a clash — a predecessor that ends
// after its successor starts — or of a cycle.
export function dependencyIssues(items: Item[], deps: Dependency[]): { cycles: Set<string>; conflicted: Set<string> } {
  const adj: Record<string, string[]> = {}
  for (const e of deps) (adj[e.from] = adj[e.from] ?? []).push(e.to)
  const cycles = new Set<string>()
  const color: Record<string, number> = {}
  const dfs = (n: string) => {
    color[n] = 1
    for (const m of adj[n] ?? []) {
      if (color[m] === 1) cycles.add(`${n}>${m}`)
      else if (!color[m]) dfs(m)
    }
    color[n] = 2
  }
  for (const n in adj) if (!color[n]) dfs(n)

  const conflicted = new Set<string>()
  for (const e of deps) {
    const to = items.find(i => i.id === e.to)
    const from = items.find(i => i.id === e.from)
    if (!to || !from) continue
    if (itemEnd(to) > from.startDay || cycles.has(`${e.from}>${e.to}`)) { conflicted.add(e.to); conflicted.add(e.from) }
  }
  return { cycles, conflicted }
}

// Items where at least one assignee is over their capacity on some day the
// item spans (counting all their work that day, not just this item). Days the
// person is away don't count: work then is a time-off conflict instead.
export function overloadedItemIds(items: Item[], resources: Resource[]): Set<string> {
  const daily: Record<string, Record<number, number>> = {}
  for (const it of items) {
    if (isInstantItem(it) || it.dur <= 0) continue
    for (const a of it.assignments) {
      const d = (daily[a.r] = daily[a.r] ?? {})
      for (let day = it.startDay; day < it.startDay + it.dur; day++) d[day] = (d[day] ?? 0) + a.pct
    }
  }
  const out = new Set<string>()
  for (const it of items) {
    if (isInstantItem(it) || it.dur <= 0) continue
    const over = it.assignments.some(a => {
      const r = resources.find(rr => rr.id === a.r)
      if (!r) return false
      for (let day = it.startDay; day < it.startDay + it.dur; day++) if (!timeOffOn(r, day) && isOverloaded(daily[a.r][day], r)) return true
      return false
    })
    if (over) out.add(it.id)
  }
  return out
}

// The person's role isn't one the item accepts (items with no required
// roles accept anyone).
export function roleMismatch(item: Pick<Item, 'requiredRoles'>, r: Pick<Resource, 'role'>): boolean {
  return !!item.requiredRoles?.length && !item.requiredRoles.includes(r.role)
}

// Summary numbers for a scenario (or a checkpoint snapshot) — cost and
// schedule totals computed over its full timeline, independent of any date
// filter, so scenarios/checkpoints stay comparable regardless of what
// range you happen to be viewing.
export function computeScenarioMetrics(data: { items: Item[]; resources: Resource[]; settings: Settings }): ScenarioMetrics {
  if (data.items.length === 0) return { totalCost: 0, endDay: null, overallocated: 0, headcount: 0, itemCount: 0 }
  let totalCost = 0
  let endDay = 0
  const resourceIds = new Set<string>()
  for (const it of data.items) {
    totalCost += itemCostInRange(it, data.resources, -Infinity, Infinity, data.settings)
    endDay = Math.max(endDay, itemEnd(it))
    for (const a of it.assignments) resourceIds.add(a.r)
  }
  const overallocated = data.resources.filter(r => isOverloaded(resPeak(r.id, data.items), r)).length
  return { totalCost, endDay, overallocated, headcount: resourceIds.size, itemCount: data.items.length }
}

export interface HeaderBand { label: string; style: React.CSSProperties }
export interface HeaderTick { label: string; style: React.CSSProperties }
export interface GridLine { style: React.CSSProperties }

export function buildHeader(
  scaleIndex: ScaleIndex, ppd: number, totalWidth: number, canvasHeight: number,
  startDay = 0, totalDays = TOTAL_DAYS
): { bands: HeaderBand[]; ticks: HeaderTick[]; gridLines: GridLine[] } {
  const bands: HeaderBand[] = []
  const ticks: HeaderTick[] = []
  const gridLines: GridLine[] = []
  const d0 = addDays(startDay)
  const td = totalDays - startDay

  const pushBand = (off: number, span: number, label: string) => {
    const l = Math.max(0, off), rgt = Math.min(off + span, td), w = (rgt - l) * ppd
    if (w <= 0) return
    bands.push({ label, style: { position: 'absolute', left: l * ppd, top: 0, height: 25, width: w, display: 'flex', alignItems: 'center', padding: '0 8px', boxSizing: 'border-box', borderRight: '1px solid #f1f1f1', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#a1a1aa', fontFamily: 'ui-monospace,Menlo,monospace', whiteSpace: 'nowrap', overflow: 'hidden' } })
  }

  const pushTick = (x: number, label: string, strong: boolean) =>
    ticks.push({ label, style: { position: 'absolute', left: x, top: 25, height: 29, display: 'flex', alignItems: 'center', paddingLeft: 5, borderLeft: `1px solid ${strong ? '#e4e4e7' : '#f4f4f5'}`, fontSize: 11, fontWeight: strong ? 600 : 400, color: strong ? '#52525b' : '#a1a1aa', fontFamily: 'ui-monospace,Menlo,monospace', whiteSpace: 'nowrap' } })

  const gl = (x: number, c: string) =>
    gridLines.push({ style: { position: 'absolute', left: x, top: 0, width: 1, height: canvasHeight, background: c } })

  const months = () => {
    let d = new Date(d0.getFullYear(), d0.getMonth(), 1)
    while ((d.getTime() - d0.getTime()) / DAY_MS < td) {
      const off = (d.getTime() - d0.getTime()) / DAY_MS
      const nx = new Date(d.getFullYear(), d.getMonth() + 1, 1)
      pushBand(off, (nx.getTime() - d.getTime()) / DAY_MS, `${monthShort(d.getMonth(), true)} ${String(d.getFullYear()).slice(2)}`)
      d = nx
    }
  }

  const quarters = () => {
    let d = new Date(d0.getFullYear(), Math.floor(d0.getMonth() / 3) * 3, 1)
    while ((d.getTime() - d0.getTime()) / DAY_MS < td) {
      const off = (d.getTime() - d0.getTime()) / DAY_MS
      const nx = new Date(d.getFullYear(), d.getMonth() + 3, 1)
      pushBand(off, (nx.getTime() - d.getTime()) / DAY_MS, `${quarterLabel(Math.floor(d.getMonth() / 3) + 1)} ${d.getFullYear()}`)
      d = nx
    }
  }

  const years = () => {
    let d = new Date(d0.getFullYear(), 0, 1)
    while ((d.getTime() - d0.getTime()) / DAY_MS < td) {
      const off = (d.getTime() - d0.getTime()) / DAY_MS
      const nx = new Date(d.getFullYear() + 1, 0, 1)
      pushBand(off, (nx.getTime() - d.getTime()) / DAY_MS, String(d.getFullYear()))
      d = nx
    }
  }

  if (scaleIndex === 0) {
    months()
    let d = new Date(d0.getFullYear(), d0.getMonth() + 1, 1)
    while ((d.getTime() - d0.getTime()) / DAY_MS < td) { gl(((d.getTime() - d0.getTime()) / DAY_MS) * ppd, '#f4f4f5'); d = new Date(d.getFullYear(), d.getMonth() + 1, 1) }
    for (let i = 0; i < td; i++) { const dt = addDays(startDay + i); pushTick(i * ppd, `${weekdayShort(dt.getDay())} ${dt.getDate()}`, dt.getDay() === 1) }
  } else if (scaleIndex === 1) {
    months()
    let d = new Date(d0.getFullYear(), d0.getMonth() + 1, 1)
    while ((d.getTime() - d0.getTime()) / DAY_MS < td) { gl(((d.getTime() - d0.getTime()) / DAY_MS) * ppd, '#f4f4f5'); d = new Date(d.getFullYear(), d.getMonth() + 1, 1) }
    for (let i = 0; i < td; i++) { const dt = addDays(startDay + i); if (dt.getDay() === 1) pushTick(i * ppd, formatMonthDay(dt), false) }
  } else if (scaleIndex === 2) {
    quarters()
    let d = new Date(d0.getFullYear(), Math.floor(d0.getMonth() / 3) * 3 + 3, 1)
    while ((d.getTime() - d0.getTime()) / DAY_MS < td) { gl(((d.getTime() - d0.getTime()) / DAY_MS) * ppd, '#eeeeef'); d = new Date(d.getFullYear(), d.getMonth() + 3, 1) }
    let m = new Date(d0.getFullYear(), d0.getMonth(), 1)
    while ((m.getTime() - d0.getTime()) / DAY_MS < td) { const off = (m.getTime() - d0.getTime()) / DAY_MS; pushTick(Math.max(0, off * ppd), monthShort(m.getMonth(), true), m.getMonth() % 3 === 0); m = new Date(m.getFullYear(), m.getMonth() + 1, 1) }
  } else {
    years()
    let d = new Date(d0.getFullYear() + 1, 0, 1)
    while ((d.getTime() - d0.getTime()) / DAY_MS < td) { gl(((d.getTime() - d0.getTime()) / DAY_MS) * ppd, '#eeeeef'); d = new Date(d.getFullYear() + 1, 0, 1) }
    let q = new Date(d0.getFullYear(), Math.floor(d0.getMonth() / 3) * 3, 1)
    while ((q.getTime() - d0.getTime()) / DAY_MS < td) { const off = (q.getTime() - d0.getTime()) / DAY_MS; pushTick(Math.max(0, off * ppd), quarterLabel(Math.floor(q.getMonth() / 3) + 1), q.getMonth() === 0); q = new Date(q.getFullYear(), q.getMonth() + 3, 1) }
  }

  return { bands, ticks, gridLines }
}

export interface Bucket { s: number; d: number; label: string }

export function buckets(scaleIndex: ScaleIndex, startDay = 0, totalDays = TOTAL_DAYS): Bucket[] {
  const out: Bucket[] = []
  const d0 = addDays(startDay)
  const td = totalDays - startDay

  if (scaleIndex === 0) {
    for (let i = 0; i < td; i++) out.push({ s: i, d: 1, label: String(new Date(d0.getTime() + i * DAY_MS).getDate()) })
  } else if (scaleIndex === 1) {
    for (let i = 0; i < td; i += 7) { const dt = new Date(d0.getTime() + i * DAY_MS); out.push({ s: i, d: Math.min(7, td - i), label: formatMonthDay(dt) }) }
  } else if (scaleIndex === 2) {
    let d = new Date(d0.getFullYear(), d0.getMonth(), 1)
    while ((d.getTime() - d0.getTime()) / DAY_MS < td) {
      const off = (d.getTime() - d0.getTime()) / DAY_MS
      const nx = new Date(d.getFullYear(), d.getMonth() + 1, 1)
      out.push({ s: Math.max(0, off), d: Math.min((nx.getTime() - d.getTime()) / DAY_MS, td - Math.max(0, off)), label: monthShort(d.getMonth(), true) })
      d = nx
    }
  } else {
    let d = new Date(d0.getFullYear(), Math.floor(d0.getMonth() / 3) * 3, 1)
    while ((d.getTime() - d0.getTime()) / DAY_MS < td) {
      const off = (d.getTime() - d0.getTime()) / DAY_MS
      const nx = new Date(d.getFullYear(), d.getMonth() + 3, 1)
      out.push({ s: Math.max(0, off), d: Math.min((nx.getTime() - d.getTime()) / DAY_MS, td - Math.max(0, off)), label: quarterLabel(Math.floor(d.getMonth() / 3) + 1) })
      d = nx
    }
  }
  return out
}
