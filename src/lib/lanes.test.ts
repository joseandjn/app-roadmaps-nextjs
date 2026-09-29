import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Item } from '@/types'
import { layoutLanes, laneForRow, moveToLane, clearLanes } from './lanes.ts'

const PPD = 4
const item = (id: string, startDay: number, dur: number, p: Partial<Item> = {}): Item =>
  ({ id, projectId: 'p1', title: id, startDay, dur, status: 'Planned', type: 'task', assignments: [], ...p })
const rows = (list: Item[]) => Object.fromEntries(layoutLanes(list, PPD).placed.map(x => [x.it.id, x.row]))

// Today's automatic layout, kept verbatim to check nothing changes without lanes.
function legacyPack(list: Item[], ppd: number) {
  const sorted = [...list].sort((a, b) => a.startDay - b.startDay)
  const edges: number[] = []
  const out: Record<string, number> = {}
  for (const it of sorted) {
    const left = it.startDay * ppd
    const right = left + (it.dur === 0 ? 132 : Math.max(7, it.dur * ppd)) + 8
    let r = 0
    for (; r < edges.length; r++) if (edges[r] <= left) break
    if (r === edges.length) edges.push(right)
    else edges[r] = right
    out[it.id] = r
  }
  return out
}

describe('layoutLanes', () => {
  it('matches the automatic layout when no item has a lane', () => {
    // z and y start the same day, listed out of id order.
    const list = [item('a', 0, 10), item('z', 5, 10), item('y', 5, 10), item('c', 12, 3), item('m', 20, 0, { type: 'milestone' }), item('d', 21, 30), item('e', 40, 5)]
    for (const ppd of [1, 4, 12]) {
      const got = Object.fromEntries(layoutLanes(list, ppd).placed.map(x => [x.it.id, x.row]))
      assert.deepEqual(got, legacyPack(list, ppd), `ppd ${ppd}`)
    }
  })

  it('puts items in their saved lane', () => {
    assert.deepEqual(rows([item('a', 0, 10, { lane: 1 }), item('b', 20, 10, { lane: 0 })]), { b: 0, a: 1 })
  })

  it('moves a pinned item down when its lane is taken at those dates', () => {
    assert.deepEqual(rows([item('a', 0, 10, { lane: 0 }), item('b', 5, 10, { lane: 0 })]), { a: 0, b: 1 })
  })

  it('fills free rows with unpinned items', () => {
    const out = rows([item('a', 0, 10, { lane: 1 }), item('free', 0, 5)])
    assert.deepEqual(out, { a: 1, free: 0 })
  })

  it('drops empty rows but keeps the order', () => {
    const l = layoutLanes([item('a', 0, 5, { lane: 3 }), item('b', 0, 5, { lane: 7 })], PPD)
    assert.deepEqual(l.placed.map(x => [x.it.id, x.row, x.lane]), [['a', 0, 3], ['b', 1, 7]])
    assert.deepEqual(l.rowLanes, [3, 7])
    assert.equal(l.rowCount, 2)
  })

  it('has one row for an empty project', () => {
    assert.equal(layoutLanes([], PPD).rowCount, 1)
  })
})

describe('laneForRow', () => {
  it('maps visible rows to lanes, with one new row below', () => {
    assert.deepEqual([-1, 0, 1, 2, 5].map(r => laneForRow([3, 7], r)), [3, 3, 7, 8, 8])
    assert.equal(laneForRow([], 2), 0)
  })
})

describe('moveToLane', () => {
  const list = [item('a', 0, 10), item('b', 0, 10), item('c', 30, 5), item('x', 0, 10, { projectId: 'p2' })]
  const frozen = { a: 0, b: 1, c: 0 }

  it('freezes the project and swaps with the item it lands on', () => {
    const out = Object.fromEntries(moveToLane(list, 'b', 0, frozen).map(i => [i.id, i.lane]))
    assert.deepEqual(out, { a: 1, b: 0, c: 0, x: undefined })
    assert.deepEqual(rows(moveToLane(list, 'b', 0, frozen).filter(i => i.projectId === 'p1')), { b: 0, c: 0, a: 1 })
  })

  it('swaps only items at overlapping dates', () => {
    const out = moveToLane(list, 'a', 1, frozen)
    assert.equal(out.find(i => i.id === 'a')!.lane, 1)
    assert.equal(out.find(i => i.id === 'b')!.lane, 0) // same dates as a: takes a's lane
    assert.equal(out.find(i => i.id === 'c')!.lane, 0) // other dates: stays
  })

  // The reported case: moving "tarea 1" down one row onto "Desarrollo Android"
  // used to push Android (and Backend below it) down, keeping the same order.
  it('moving down past an item puts that item above, with no gap or cascade', () => {
    const rows = [item('ios', 0, 9), item('t1', 0, 12), item('android', 0, 9), item('backend', 3, 5)]
    const shown = { ios: 1, t1: 2, android: 6, backend: 7 }
    const out = Object.fromEntries(moveToLane(rows, 't1', 6, shown).map(i => [i.id, i.lane]))
    assert.deepEqual(out, { ios: 1, android: 2, t1: 6, backend: 7 })
    const order = layoutLanes(moveToLane(rows, 't1', 6, shown), PPD).placed.sort((a, b) => a.row - b.row).map(p => p.it.id)
    assert.deepEqual(order, ['ios', 'android', 't1', 'backend'])
  })

  it('dropping back on its own lane changes nothing', () => {
    const out = moveToLane(list, 'a', 0, frozen)
    assert.deepEqual(out.map(i => i.lane), [0, 1, 0, undefined])
  })

  it('leaves unfrozen, lane-less items alone (hidden by a filter)', () => {
    const out = moveToLane([...list, item('hidden', 0, 10)], 'b', 0, frozen)
    assert.equal(out.find(i => i.id === 'hidden')!.lane, undefined)
  })
})

describe('clearLanes', () => {
  it('removes lanes of one project only', () => {
    const out = clearLanes([item('a', 0, 1, { lane: 2 }), item('x', 0, 1, { projectId: 'p2', lane: 1 })], 'p1')
    assert.equal('lane' in out[0], false)
    assert.equal(out[1].lane, 1)
  })
})
