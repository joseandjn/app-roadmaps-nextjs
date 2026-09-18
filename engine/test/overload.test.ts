import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { analyzeRoadmap } from '../analyze.ts'
import type { OverloadFinding } from '../findings.ts'
import { ORIGIN, item, snapshot } from './helpers.ts'

const overloads = (report: ReturnType<typeof analyzeRoadmap>) => report.findings.filter((f): f is OverloadFinding => f.kind === 'overload')
const load = (r: string, pct: number) => [{ r, pct }]

describe('overload analysis', () => {
  it('skips weekends and reports only the overlapping working days', () => {
    // A covers days 0-9 and B days 5-14. They overlap on 5-9, but 5 and 6 are Sat/Sun.
    const snap = snapshot([
      item('A', 0, 10, { assignments: load('r1', 60) }),
      item('B', 5, 10, { assignments: load('r1', 60) }),
    ])
    const [f] = overloads(analyzeRoadmap(snap, { originDate: ORIGIN }))
    assert.equal(f.evidence.startDay, 7)
    assert.equal(f.evidence.endDay, 9)
    assert.equal(f.evidence.workingDays, 3)
    assert.equal(f.evidence.peakPct, 120)
    assert.equal(f.evidence.excessPersonDays, 0.6)
    assert.equal(f.evidence.startDate, '2026-01-12')
    assert.equal(f.severity, 'low')
    assert.deepEqual(f.evidence.items.map(i => [i.id, i.pct]), [['A', 60], ['B', 60]])
  })

  it('treats a weekend between overloaded days as one continuous window', () => {
    const snap = snapshot([
      item('A', 3, 6, { assignments: load('r1', 60) }),
      item('B', 3, 6, { assignments: load('r1', 60) }),
    ])
    const found = overloads(analyzeRoadmap(snap, { originDate: ORIGIN }))
    assert.equal(found.length, 1)
    assert.equal(found[0].evidence.workingDays, 4)
    assert.equal(found[0].evidence.startDay, 3)
    assert.equal(found[0].evidence.endDay, 8)
  })

  it('splits windows when a working day in between is not overloaded', () => {
    const snap = snapshot([
      item('A', 1, 1, { assignments: load('r1', 60) }),
      item('B', 1, 1, { assignments: load('r1', 60) }),
      item('C', 3, 1, { assignments: load('r1', 60) }),
      item('D', 3, 1, { assignments: load('r1', 60) }),
    ])
    assert.equal(overloads(analyzeRoadmap(snap, { originDate: ORIGIN })).length, 2)
  })

  it('does not flag a load of exactly 100%', () => {
    const snap = snapshot([
      item('A', 0, 3, { assignments: load('r1', 50) }),
      item('B', 0, 3, { assignments: load('r1', 50) }),
    ])
    assert.equal(overloads(analyzeRoadmap(snap, { originDate: ORIGIN })).length, 0)
  })

  it('ignores done items, milestones and unknown resources', () => {
    const snap = snapshot([
      item('A', 0, 3, { assignments: load('r1', 80) }),
      item('B', 0, 3, { assignments: load('r1', 80), status: 'Done' }),
      item('M', 0, 0, { assignments: load('r1', 80), type: 'milestone' }),
      item('C', 0, 3, { assignments: load('ghost', 80) }),
    ])
    assert.equal(overloads(analyzeRoadmap(snap, { originDate: ORIGIN })).length, 0)
  })

  it('ignores days before today', () => {
    const snap = snapshot([
      item('A', 0, 5, { assignments: load('r1', 60) }),
      item('B', 0, 5, { assignments: load('r1', 60) }),
    ])
    const all = overloads(analyzeRoadmap(snap, { originDate: ORIGIN }))
    const fromDay3 = overloads(analyzeRoadmap(snap, { originDate: ORIGIN, todayDay: 3 }))
    assert.equal(all[0].evidence.workingDays, 5)
    assert.equal(fromDay3[0].evidence.workingDays, 2)
    assert.equal(fromDay3[0].evidence.startDay, 3)
  })

  it('does not count a holiday as a working day', () => {
    // 2026-01-07 (day 2) is a holiday.
    const snap = snapshot(
      [item('A', 1, 3, { assignments: load('r1', 60) }), item('B', 1, 3, { assignments: load('r1', 60) })],
      [],
      { settings: { countWeekends: false, holidays: ['2026-01-07'] } },
    )
    const [f] = overloads(analyzeRoadmap(snap, { originDate: ORIGIN }))
    assert.equal(f.evidence.workingDays, 2)
  })

  it('counts weekends when the setting says so', () => {
    const snap = snapshot(
      [item('A', 5, 2, { assignments: load('r1', 60) }), item('B', 5, 2, { assignments: load('r1', 60) })],
      [],
      { settings: { countWeekends: true, holidays: [] } },
    )
    assert.equal(overloads(analyzeRoadmap(snap, { originDate: ORIGIN }))[0].evidence.workingDays, 2)
  })

  it('rates severity by peak and by excess person-days', () => {
    const peak = snapshot([item('A', 0, 1, { assignments: load('r1', 100) }), item('B', 0, 1, { assignments: load('r1', 60) })])
    assert.equal(overloads(analyzeRoadmap(peak, { originDate: ORIGIN }))[0].severity, 'high')

    const long = snapshot([item('A', 0, 5, { assignments: load('r1', 100) }), item('B', 0, 5, { assignments: load('r1', 30) })])
    assert.equal(overloads(analyzeRoadmap(long, { originDate: ORIGIN }))[0].severity, 'medium')
  })

  it('reports slack for items in a dependency chain and null for free items', () => {
    // C waits on both B (critical) and D (7 days of slack). X has no dependencies.
    const snap = snapshot(
      [
        item('A', 0, 5), item('B', 5, 5), item('C', 10, 5),
        item('D', 0, 3, { assignments: load('r1', 60) }),
        item('X', 0, 3, { assignments: load('r1', 60) }),
      ],
      [['B', 'A'], ['C', 'B'], ['C', 'D']],
    )
    const [f] = overloads(analyzeRoadmap(snap, { originDate: ORIGIN }))
    const slack = Object.fromEntries(f.evidence.items.map(i => [i.id, i.slackDays]))
    assert.deepEqual(slack, { D: 7, X: null })
  })

  it('takes the tightest of several dependents as the slack', () => {
    const snap = snapshot(
      [
        item('P', 0, 3, { assignments: load('r1', 60) }), item('Q', 5, 3), item('R', 8, 3),
        item('X', 0, 3, { assignments: load('r1', 60) }),
      ],
      [['Q', 'P'], ['R', 'P']],
    )
    const [f] = overloads(analyzeRoadmap(snap, { originDate: ORIGIN }))
    assert.equal(f.evidence.items.find(i => i.id === 'P')?.slackDays, 2)
  })

  it('writes texts in the requested locale', () => {
    const snap = snapshot([item('A', 0, 3, { assignments: load('r1', 80) }), item('B', 0, 3, { assignments: load('r1', 80) })])
    const es = overloads(analyzeRoadmap(snap, { originDate: ORIGIN, locale: 'es' }))[0]
    const en = overloads(analyzeRoadmap(snap, { originDate: ORIGIN, locale: 'en' }))[0]
    assert.match(es.title, /Sobrecarga de Ana/)
    assert.match(en.title, /Ana overloaded/)
  })
})
