import type { Item } from '@/types'

// Estimation data on items: the estimate history, the completion day and the
// deviation between them. Pure (no app imports at runtime) so it can be tested
// with `node --test`.

// Milestones and releases are instants: nothing to estimate.
export const isInstant = (it: Pick<Item, 'type'>): boolean => it.type === 'milestone' || it.type === 'release'

// A new item's first estimate is the duration it's created with. Instants and
// items that already have one are returned unchanged.
export function withInitialEstimate<T extends Item>(it: T, at: string): T {
  if (isInstant(it) || it.estimates?.length) return it
  return { ...it, estimates: [{ dur: it.dur, at }] }
}

// Keeps `completedDay` in step with the status after a change from `prev`
// (null for a new item): entering Done sets it to `today` unless one was
// already picked, leaving Done drops it. An item that was already Done keeps
// whatever it has, so editing an old Done item doesn't invent a completion day.
export function withCompletion<T extends Item>(prev: Item | null, next: T, today: number): T {
  if (next.status === 'Done') {
    if (prev?.status === 'Done' || next.completedDay !== undefined) return next
    return { ...next, completedDay: today }
  }
  if (next.completedDay === undefined) return next
  const copy = { ...next }
  delete copy.completedDay
  return copy
}

// Trimmed description, or undefined when blank (stored as absent).
export function cleanDescription(text: string | undefined): string | undefined {
  const s = text?.trim()
  return s ? s : undefined
}

export interface EstimateSummary {
  original: number | null
  latest: number | null
  reestimates: number // how many after the original
  // Calendar days from start to completion; null unless the item is a Done
  // task with a completion day on or after its start.
  actual: number | null
  // (actual - estimate) / estimate, e.g. 0.25 = took 25% longer.
  vsOriginal: number | null
  vsLatest: number | null
}

export function estimateSummary(it: Item): EstimateSummary {
  const est = it.estimates ?? []
  const original = est.length ? est[0].dur : null
  const latest = est.length ? est[est.length - 1].dur : null
  const span = it.completedDay !== undefined ? it.completedDay - it.startDay : null
  const actual = it.status === 'Done' && !isInstant(it) && span !== null && span >= 0 ? span : null
  const dev = (e: number | null) => (actual !== null && e ? (actual - e) / e : null)
  return { original, latest, reestimates: Math.max(0, est.length - 1), actual, vsOriginal: dev(original), vsLatest: dev(latest) }
}

export type DeviationTone = 'ok' | 'warn' | 'bad'

// Within ±10% is on target, up to ±30% is off, beyond that is a miss. Coming
// in well under the estimate counts too: it's still a poor estimate.
export function deviationTone(dev: number): DeviationTone {
  const a = Math.abs(dev)
  return a <= 0.1 ? 'ok' : a <= 0.3 ? 'warn' : 'bad'
}
