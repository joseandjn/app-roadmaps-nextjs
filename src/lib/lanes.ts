import type { Item } from '@/types'

// Rows ("lanes") of a project in the timeline. Items with a saved `lane` go
// there (or, if it's taken at those dates, the next free one below); items
// without one fill the first free row, as the automatic layout always did.
// Rows nobody uses are dropped, so filters never leave gaps.
// docs/timeline-order-and-copy-backlog.md, O1. Pure: tested with `node --test`.

export interface LanePlacement {
  it: Item
  row: number // visible row, after dropping empty ones
  lane: number // row as stored in Item.lane
}

export interface LaneLayout {
  placed: LanePlacement[]
  rowCount: number
  rowLanes: number[] // visible row → stored lane
}

// Horizontal space an item takes, in pixels: a milestone/release is drawn as
// a diamond plus its label, so it's wider than its zero duration; every item
// keeps an 8px gap after it.
function span(it: Item, ppd: number): [number, number] {
  const left = it.startDay * ppd
  const w = it.dur === 0 ? 132 : Math.max(7, it.dur * ppd)
  return [left, left + w + 8]
}

export function layoutLanes(list: Item[], ppd: number): LaneLayout {
  const taken = new Map<number, [number, number][]>()
  const free = (lane: number, [l, r]: [number, number]) => !(taken.get(lane) ?? []).some(([a, b]) => l < b && a < r)
  const place = (lane: number, s: [number, number]) => {
    const list = taken.get(lane)
    if (list) list.push(s)
    else taken.set(lane, [s])
  }

  // Stable sort: items starting the same day keep their list order, as before.
  const byStart = (a: Item, b: Item) => a.startDay - b.startDay
  const pinned = list.filter(i => i.lane !== undefined).sort((a, b) => a.lane! - b.lane! || byStart(a, b))
  const auto = list.filter(i => i.lane === undefined).sort(byStart)

  const lanes: { it: Item; lane: number }[] = []
  for (const it of pinned) {
    const s = span(it, ppd)
    let lane = Math.max(0, it.lane!)
    while (!free(lane, s)) lane++
    place(lane, s)
    lanes.push({ it, lane })
  }
  for (const it of auto) {
    const s = span(it, ppd)
    let lane = 0
    while (!free(lane, s)) lane++
    place(lane, s)
    lanes.push({ it, lane })
  }

  const rowLanes = [...new Set(lanes.map(x => x.lane))].sort((a, b) => a - b)
  const rowOf = new Map(rowLanes.map((lane, row) => [lane, row]))
  return {
    placed: lanes.map(({ it, lane }) => ({ it, lane, row: rowOf.get(lane)! })),
    rowCount: Math.max(1, rowLanes.length),
    rowLanes,
  }
}

// The stored lane for a visible row. One row past the last is a new row;
// anything above the first row is the first row.
export function laneForRow(rowLanes: number[], row: number): number {
  if (!rowLanes.length) return 0
  const r = Math.max(0, Math.min(row, rowLanes.length))
  return r < rowLanes.length ? rowLanes[r] : rowLanes[rowLanes.length - 1] + 1
}

const daysOverlap = (a: Item, b: Item) => a.startDay < b.startDay + Math.max(1, b.dur) && b.startDay < a.startDay + Math.max(1, a.dur)

// Moves item `id` to `lane` within its project. `frozen` is the lane every
// visible item of that project is shown in: they all keep it, so pinning one
// item doesn't reshuffle the rest. Items already in that lane at overlapping
// dates swap places with it: they take the lane the moved item left, so
// moving down past an item puts that item above it (and moving up, below),
// with no gap left behind and nothing else pushed around.
export function moveToLane(items: Item[], id: string, lane: number, frozen: Record<string, number>): Item[] {
  const moved = items.find(i => i.id === id)
  if (!moved) return items
  const target = { ...moved, lane: Math.max(0, lane) }
  const origin = frozen[id] ?? moved.lane
  return items.map(it => {
    if (it.id === id) return target
    if (it.projectId !== moved.projectId) return it
    const current = frozen[it.id] ?? it.lane
    if (current === undefined) return it
    const displaced = current === target.lane && current !== origin && daysOverlap(it, target)
    // Without a known origin (not shown when the drag began), fall back to the next lane down.
    const next = displaced ? origin ?? current + 1 : current
    return next === it.lane ? it : { ...it, lane: next }
  })
}

// Back to the automatic layout for one project.
export function clearLanes(items: Item[], projectId: string): Item[] {
  return items.map(it => {
    if (it.projectId !== projectId || it.lane === undefined) return it
    const copy = { ...it }
    delete copy.lane
    return copy
  })
}
