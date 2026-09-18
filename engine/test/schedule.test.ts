import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { analyzeRoadmap } from '../analyze.ts'
import type { CriticalPathFinding, DependencyConflictFinding, DependencyCycleFinding } from '../findings.ts'
import { ORIGIN, item, snapshot } from './helpers.ts'

type Report = ReturnType<typeof analyzeRoadmap>
const critical = (r: Report) => r.findings.filter((f): f is CriticalPathFinding => f.kind === 'critical_path')
const conflicts = (r: Report) => r.findings.filter((f): f is DependencyConflictFinding => f.kind === 'dependency_conflict')
const cycles = (r: Report) => r.findings.filter((f): f is DependencyCycleFinding => f.kind === 'dependency_cycle')

// A(0-5) -> B(5-10) -> C(10-15), and D(0-3) also feeds C but finishes long before B does.
const chain = () => snapshot(
  [item('A', 0, 5), item('B', 5, 5), item('C', 10, 5), item('D', 0, 3)],
  [['B', 'A'], ['C', 'B'], ['C', 'D']],
)

describe('critical path', () => {
  it('traces the chain that gates the item finishing last', () => {
    const [f] = critical(analyzeRoadmap(chain(), { originDate: ORIGIN }))
    assert.deepEqual(f.evidence.chain.map(c => c.id), ['A', 'B', 'C'])
    assert.equal(f.evidence.spanDays, 15)
    assert.equal(f.evidence.idleWorkingDays, 0)
    assert.equal(f.evidence.startDate, '2026-01-05')
    assert.equal(f.evidence.endDate, '2026-01-20')
    assert.equal(f.severity, 'low')
    assert.deepEqual(f.evidence.chain.map(c => c.gapBeforeDays), [null, 0, 0])
  })

  it('counts only working days as idle time between chained items', () => {
    // B starts 3 calendar days after A ends, but two of them are Sat/Sun.
    const snap = snapshot([item('A', 0, 5), item('B', 8, 5)], [['B', 'A']])
    const [f] = critical(analyzeRoadmap(snap, { originDate: ORIGIN }))
    assert.equal(f.evidence.chain[1].gapBeforeDays, 3)
    assert.equal(f.evidence.chain[1].idleWorkingDaysBefore, 1)
    assert.equal(f.evidence.idleWorkingDays, 1)
    assert.equal(f.severity, 'low')
  })

  it('rates the path medium when a lot of idle time sits between links', () => {
    const snap = snapshot([item('A', 0, 2), item('B', 16, 2)], [['B', 'A']])
    const [f] = critical(analyzeRoadmap(snap, { originDate: ORIGIN }))
    assert.equal(f.evidence.idleWorkingDays, 10)
    assert.equal(f.severity, 'medium')
  })

  it('follows the predecessor that finishes last, not the longest one', () => {
    const snap = snapshot([item('A', 0, 2), item('B', 0, 9), item('C', 9, 3)], [['C', 'A'], ['C', 'B']])
    const [f] = critical(analyzeRoadmap(snap, { originDate: ORIGIN }))
    assert.deepEqual(f.evidence.chain.map(c => c.id), ['B', 'C'])
  })

  it('does not report standalone items', () => {
    const report = analyzeRoadmap(snapshot([item('A', 0, 5), item('B', 0, 5)]), { originDate: ORIGIN })
    assert.equal(critical(report).length, 0)
  })

  it('produces one path per independent dependency graph', () => {
    const snap = snapshot(
      [item('A', 0, 5), item('B', 5, 5), item('X', 0, 5), item('Y', 5, 5)],
      [['B', 'A'], ['Y', 'X']],
    )
    assert.equal(critical(analyzeRoadmap(snap, { originDate: ORIGIN })).length, 2)
  })

  it('ignores self and duplicate dependencies', () => {
    const snap = snapshot([item('A', 0, 5), item('B', 5, 5)], [['B', 'A'], ['B', 'A'], ['A', 'A']])
    const report = analyzeRoadmap(snap, { originDate: ORIGIN })
    assert.equal(critical(report).length, 1)
    assert.equal(conflicts(report).length, 0)
  })

  it('rates the path high when a chain item is at risk', () => {
    const snap = chain()
    snap.items[1] = { ...snap.items[1], status: 'At Risk' }
    const [f] = critical(analyzeRoadmap(snap, { originDate: ORIGIN }))
    assert.equal(f.severity, 'high')
    assert.equal(f.evidence.atRiskCount, 1)
  })

  it('rates the path high when a chain item is past its end and unfinished', () => {
    const [f] = critical(analyzeRoadmap(chain(), { originDate: ORIGIN, todayDay: 8 }))
    assert.equal(f.evidence.overdueCount, 1)
    assert.equal(f.severity, 'high')
  })

  it('ignores finished items when building chains', () => {
    const snap = chain()
    snap.items[0] = { ...snap.items[0], status: 'Done' }
    const [f] = critical(analyzeRoadmap(snap, { originDate: ORIGIN }))
    assert.deepEqual(f.evidence.chain.map(c => c.id), ['B', 'C'])
  })
})

describe('dependency conflicts', () => {
  it('flags a successor that starts before its predecessor ends', () => {
    const snap = snapshot([item('A', 0, 10), item('B', 7, 5)], [['B', 'A']])
    const report = analyzeRoadmap(snap, { originDate: ORIGIN })
    const [c] = conflicts(report)
    assert.equal(c.evidence.overlapDays, 3)
    assert.equal(c.severity, 'medium')
    assert.equal(c.evidence.predecessor.id, 'A')
    assert.equal(c.evidence.successor.id, 'B')
    const [path] = critical(report)
    assert.equal(path.evidence.chain[1].gapBeforeDays, -3)
    assert.equal(path.severity, 'medium')
  })

  it('does not flag back-to-back or later successors', () => {
    const snap = snapshot([item('A', 0, 5), item('B', 5, 5), item('C', 12, 5)], [['B', 'A'], ['C', 'B']])
    assert.equal(conflicts(analyzeRoadmap(snap, { originDate: ORIGIN })).length, 0)
  })

  it('does not flag dependencies on finished items', () => {
    const snap = snapshot([item('A', 0, 10, { status: 'Done' }), item('B', 7, 5)], [['B', 'A']])
    assert.equal(conflicts(analyzeRoadmap(snap, { originDate: ORIGIN })).length, 0)
  })

  it('scales severity with the overlap', () => {
    const snap = snapshot([item('A', 0, 20), item('B', 5, 5)], [['B', 'A']])
    assert.equal(conflicts(analyzeRoadmap(snap, { originDate: ORIGIN }))[0].severity, 'high')
  })
})

describe('dependency cycles', () => {
  it('reports a cycle and keeps analysing everything else', () => {
    const snap = snapshot(
      [item('X', 0, 5), item('Y', 5, 5), item('Z', 10, 5), item('A', 0, 5), item('B', 5, 5)],
      [['Y', 'X'], ['X', 'Y'], ['Z', 'X'], ['B', 'A']],
    )
    const report = analyzeRoadmap(snap, { originDate: ORIGIN })
    const [cycle] = cycles(report)
    assert.deepEqual(cycle.evidence.items.map(i => i.id).sort(), ['X', 'Y'])
    assert.equal(cycle.severity, 'high')
    assert.deepEqual(critical(report).map(c => c.evidence.chain.map(i => i.id)), [['A', 'B']])
  })
})

describe('ranking and summary', () => {
  it('orders findings by severity first and counts them', () => {
    const snap = snapshot(
      [item('A', 0, 20), item('B', 5, 5), item('C', 30, 5), item('D', 35, 5)],
      [['B', 'A'], ['D', 'C']],
    )
    const report = analyzeRoadmap(snap, { originDate: ORIGIN })
    const severities = report.findings.map(f => f.severity)
    assert.deepEqual(severities, [...severities].sort((a, b) => ['high', 'medium', 'low'].indexOf(a) - ['high', 'medium', 'low'].indexOf(b)))
    assert.equal(report.summary.findingCount, report.findings.length)
    assert.equal(report.summary.bySeverity.high + report.summary.bySeverity.medium + report.summary.bySeverity.low, report.findings.length)
  })
})
