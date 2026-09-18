import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { analyzeRoadmap } from '../analyze.ts'
import type { OversizedItemsFinding, SprintSpilloverFinding } from '../findings.ts'
import { ORIGIN, item, snapshot } from './helpers.ts'

const sprints = [
  { id: 's1', name: 'Sprint 1', startDay: 0, dur: 14 },
  { id: 's2', name: 'Sprint 2', startDay: 14, dur: 14 },
  { id: 's3', name: 'Sprint 3', startDay: 28, dur: 14 },
]
type Report = ReturnType<typeof analyzeRoadmap>
const spill = (r: Report) => r.findings.filter((f): f is SprintSpilloverFinding => f.kind === 'sprint_spillover')
const oversized = (r: Report) => r.findings.filter((f): f is OversizedItemsFinding => f.kind === 'oversized_items')
const sprintFindings = (r: Report) => r.findings.filter(f => f.kind === 'sprint_spillover' || f.kind === 'oversized_items')
const run = (items: ReturnType<typeof item>[], todayDay: number | null = null) =>
  analyzeRoadmap(snapshot(items, [], { sprints }), { originDate: ORIGIN, todayDay })

describe('sprint fit', () => {
  it('flags a task that fits in a sprint but crosses its boundary', () => {
    const [f] = spill(run([item('T', 10, 8)]))
    assert.equal(f.evidence.sprintId, 's1')
    assert.equal(f.evidence.items[0].spillDays, 4)
    assert.equal(f.evidence.sprintEndDate, '2026-01-19')
    assert.equal(f.severity, 'low')
    assert.match(f.title, /Sprint 1: 1 tarea cruza el límite del sprint/)
  })

  it('accepts a task that ends exactly at the sprint boundary', () => {
    assert.equal(spill(run([item('T', 0, 14)])).length, 0)
  })

  it('reports tasks longer than their sprint separately', () => {
    const report = run([item('T', 10, 20)])
    assert.equal(spill(report).length, 0)
    const [f] = oversized(report)
    assert.equal(f.evidence.items[0].dur, 20)
    assert.equal(f.evidence.items[0].sprintDur, 14)
    assert.match(f.detail, /sprint de 14 días/)
  })

  it('groups crossing tasks per sprint and raises severity from three', () => {
    const [f] = spill(run([item('A', 10, 6), item('B', 11, 6), item('C', 12, 8)]))
    assert.equal(f.evidence.items.length, 3)
    assert.equal(f.severity, 'medium')
    assert.deepEqual(f.evidence.items.map(i => i.id), ['C', 'B', 'A']) // most spill first
  })

  it('exempts epics, milestones, releases and finished tasks', () => {
    const report = run([
      item('E', 10, 8, { type: 'epic' }),
      item('M', 13, 0, { type: 'milestone' }),
      item('R', 13, 0, { type: 'release' }),
      item('D', 10, 8, { status: 'Done' }),
    ])
    assert.equal(sprintFindings(report).length, 0)
  })

  it('ignores sprints that are already over', () => {
    assert.equal(spill(run([item('T', 10, 8)], 20)).length, 0)
    assert.equal(spill(run([item('T', 24, 8)], 20)).length, 1)
  })

  it('ignores tasks that start outside every sprint, and snapshots without sprints', () => {
    assert.equal(sprintFindings(run([item('T', 100, 8)])).length, 0)
    assert.equal(sprintFindings(analyzeRoadmap(snapshot([item('T', 10, 8)]), { originDate: ORIGIN })).length, 0)
  })
})
