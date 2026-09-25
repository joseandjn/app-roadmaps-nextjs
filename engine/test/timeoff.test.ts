import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { analyzeRoadmap } from '../analyze.ts'
import { parseAnalyzeRequest } from '../api.ts'
import type { EngineTimeOff } from '../domain.ts'
import type { IdleCapacityFinding, OverloadFinding, TimeOffConflictFinding, UnassignedResourcesFinding } from '../findings.ts'
import { ORIGIN, item, snapshot } from './helpers.ts'

type Report = ReturnType<typeof analyzeRoadmap>
const conflicts = (r: Report) => r.findings.filter((f): f is TimeOffConflictFinding => f.kind === 'time_off_conflict')
const overloads = (r: Report) => r.findings.filter((f): f is OverloadFinding => f.kind === 'overload')
const idle = (r: Report) => r.findings.filter((f): f is IdleCapacityFinding => f.kind === 'idle_capacity')
const unassigned = (r: Report) => r.findings.filter((f): f is UnassignedResourcesFinding => f.kind === 'unassigned_resources')
const work = (r: string, pct = 100) => [{ r, pct }]
const ana = (timeOff: EngineTimeOff[], extra: object = {}) => ({ resources: [{ id: 'r1', name: 'Ana', timeOff, ...extra }] })
const run = (snap: ReturnType<typeof snapshot>, todayDay: number | null = null, locale: 'es' | 'en' = 'es') => analyzeRoadmap(snap, { originDate: ORIGIN, todayDay, locale })

// Day 0 is Monday 2026-01-05 (see helpers).
describe('time off conflicts', () => {
  it('reports work assigned on working days of an absence', () => {
    // A runs Mon 0 – Fri 11 at 100%; Ana is away Wed 2 – Fri 4.
    const snap = snapshot([item('A', 0, 12, { assignments: work('r1') })], [], ana([{ startDay: 2, dur: 3, note: 'Vacaciones' }]))
    const [f] = conflicts(run(snap))
    assert.equal(f.evidence.workingDays, 3)
    assert.equal(f.evidence.personDays, 3)
    assert.equal(f.evidence.startDate, '2026-01-07')
    assert.equal(f.evidence.endDate, '2026-01-09')
    assert.equal(f.evidence.timeOffEndDate, '2026-01-09')
    assert.equal(f.evidence.note, 'Vacaciones')
    assert.deepEqual(f.evidence.items.map(i => [i.id, i.pct]), [['A', 100]])
    assert.equal(f.severity, 'medium')
    assert.match(f.title, /Ana tiene trabajo asignado durante su ausencia \(Vacaciones\)/)
  })

  it('counts only working days, and grades by person-days', () => {
    // Away Thu 3 – Wed 9: Thu, Fri, Mon, Tue, Wed = 5 working days at 100% → high.
    const snap = snapshot([item('A', 0, 15, { assignments: work('r1') })], [], ana([{ startDay: 3, dur: 7 }]))
    const [f] = conflicts(run(snap))
    assert.equal(f.evidence.workingDays, 5)
    assert.equal(f.severity, 'high')
    // Same absence at 20%: 1 person-day → low.
    const light = snapshot([item('A', 0, 15, { assignments: work('r1', 20) })], [], ana([{ startDay: 3, dur: 7 }]))
    assert.equal(conflicts(run(light))[0].severity, 'low')
  })

  it('reports nothing when the absence has no work on it', () => {
    const snap = snapshot([item('A', 0, 2, { assignments: work('r1') })], [], ana([{ startDay: 7, dur: 5 }]))
    assert.equal(conflicts(run(snap)).length, 0)
  })

  it('ignores finished items and days before today', () => {
    const done = snapshot([item('A', 0, 12, { status: 'Done', assignments: work('r1') })], [], ana([{ startDay: 2, dur: 3 }]))
    assert.equal(conflicts(run(done)).length, 0)
    const past = snapshot([item('A', 0, 12, { assignments: work('r1') })], [], ana([{ startDay: 2, dur: 3 }]))
    assert.equal(conflicts(run(past, 7)).length, 0)
  })

  it('counts overlapping entries once', () => {
    const snap = snapshot([item('A', 0, 12, { assignments: work('r1') })], [], ana([{ startDay: 2, dur: 3 }, { startDay: 3, dur: 2 }]))
    const found = conflicts(run(snap))
    assert.equal(found.length, 1)
    assert.equal(found[0].evidence.workingDays, 3)
  })

  it('writes the English text too', () => {
    const snap = snapshot([item('A', 0, 12, { assignments: work('r1') })], [], ana([{ startDay: 2, dur: 1 }]))
    const [f] = conflicts(run(snap, null, 'en'))
    assert.match(f.title, /Ana has work assigned during time off/)
    assert.match(f.detail, /on Jan 7, 2026/)
  })
})

describe('time off in other analyses', () => {
  it('overload ignores the days the person is away', () => {
    // Two 60% items Mon 0 – Fri 4 overload every day; away on Wed 2 splits it in two windows.
    const snap = snapshot([
      item('A', 0, 5, { assignments: work('r1', 60) }),
      item('B', 0, 5, { assignments: work('r1', 60) }),
    ], [], ana([{ startDay: 2, dur: 1 }]))
    const found = overloads(run(snap))
    assert.deepEqual(found.map(f => [f.evidence.startDay, f.evidence.endDay]), [[0, 1], [3, 4]])
    assert.equal(conflicts(run(snap))[0].evidence.personDays, 1.2)
  })

  it('idle capacity leaves time off out: an absence covering the gap is not idle', () => {
    // Work on week 1 and week 3; the free week 2 (days 7-11) is all time off.
    const snap = snapshot([item('A', 0, 5, { assignments: work('r1') }), item('B', 14, 5, { assignments: work('r1') })], [], ana([{ startDay: 7, dur: 5 }]))
    assert.equal(idle(run(snap)).length, 0)
  })

  it('an absence inside a long gap splits it', () => {
    // Free weeks 2-4 (days 7-25, 15 working days); away week 3 (days 14-18) leaves two 5-day runs.
    const snap = snapshot([item('A', 0, 5, { assignments: work('r1') }), item('B', 28, 5, { assignments: work('r1') })], [], ana([{ startDay: 14, dur: 5 }]))
    const runs = idle(run(snap)).map(f => [f.evidence.startDay, f.evidence.endDay, f.evidence.idleWorkingDays]).sort((a, b) => a[0] - b[0])
    assert.deepEqual(runs, [[7, 11, 5], [21, 25, 5]])
  })

  it('someone away the whole time is not reported as unassigned', () => {
    const snap = snapshot([item('A', 0, 20, { assignments: work('r2') })], [], {
      resources: [{ id: 'r1', name: 'Ana', timeOff: [{ startDay: 0, dur: 20 }] }, { id: 'r2', name: 'Luis' }],
    })
    assert.equal(unassigned(run(snap)).length, 0)
  })

  it('prices an unassigned person only for the days they are around', () => {
    // Days 0-19 hold 15 working days; away 5 of them → 10 days at 100/day (monthly 3044 / 30.44).
    const snap = snapshot([item('A', 0, 20, { assignments: work('r2') })], [], {
      resources: [{ id: 'r1', name: 'Ana', cost: 3044, costUnit: 'month', timeOff: [{ startDay: 7, dur: 5 }] }, { id: 'r2', name: 'Luis' }],
    })
    const [u] = unassigned(run(snap))
    assert.equal(u.evidence.people[0].idleCost, 1000)
  })
})

describe('time off validation', () => {
  const withTimeOff = (timeOff: unknown) => ({ snapshot: snapshot([item('A', 0, 3)], [], { resources: [{ id: 'r1', name: 'Ana', timeOff }] as never }), originDate: ORIGIN })

  it('accepts entries and keeps a trimmed note', () => {
    const r = parseAnalyzeRequest(withTimeOff([{ startDay: 2, dur: 3, note: '  Vacaciones ' }, { startDay: 9, dur: 1, note: '' }]))
    assert.equal(r.ok, true)
    if (r.ok) assert.deepEqual(r.value.snapshot.resources[0].timeOff, [{ startDay: 2, dur: 3, note: 'Vacaciones' }, { startDay: 9, dur: 1 }])
  })

  it('rejects malformed entries', () => {
    const bad = (v: unknown) => { const r = parseAnalyzeRequest(withTimeOff(v)); return r.ok ? '' : r.error }
    assert.match(bad('soon'), /timeOff must be an array/)
    assert.match(bad([{ startDay: 1.5, dur: 2 }]), /startDay/)
    assert.match(bad([{ startDay: 1, dur: 0 }]), /dur/)
  })
})
