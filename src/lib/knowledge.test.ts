import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Item, ScenarioData } from '@/types'
import { buildKnowledge, toJsonl, toMarkdown } from './knowledge.ts'

// Day 0 is Monday 2026-01-05.
const ORIGIN = '2026-01-05'
const AT = '2026-01-05T10:00:00.000Z'
const item = (p: Partial<Item> & { id: string }): Item => ({ projectId: 'p1', title: p.id, startDay: 0, dur: 10, status: 'Planned', type: 'task', assignments: [], ...p })

function scenario(items: Item[], deps: ScenarioData['deps'] = []): ScenarioData {
  return {
    projects: [{ id: 'p1', name: 'Checkout', desc: '', owner: 'r1', category: 'Product', color: '#000', status: 'In Progress' }],
    items,
    resources: [{ id: 'r1', name: 'Ana', role: 'Backend', cost: 1000, costUnit: 'month' }],
    deps,
    sprints: [],
    settings: { workHoursPerDay: 8, currencyCode: 'USD', currencySymbol: '$', countWeekends: false, holidays: ['2026-01-07'] },
    roles: [],
  }
}

const done = item({
  id: 'a', title: 'Login', description: 'Scope: login screen', startDay: 0, dur: 14, status: 'Done', completedDay: 14,
  requiredRoles: ['Backend'], assignments: [{ r: 'r1', pct: 50 }],
  estimates: [{ dur: 10, at: AT }, { dur: 12, at: AT, reason: 'added reset' }],
})

describe('buildKnowledge', () => {
  it('builds a record for a finished task', () => {
    const [r] = buildKnowledge(scenario([done]), ORIGIN)
    assert.equal(r.title, 'Login')
    assert.deepEqual(r.project, { name: 'Checkout', category: 'Product' })
    assert.equal(r.start, '2026-01-05')
    assert.equal(r.completed, '2026-01-19')
    // 14 calendar days = 2 weeks = 10 weekdays, minus the holiday on the 7th.
    assert.deepEqual(r.actual, { calendarDays: 14, workingDays: 9, personDays: 4.5 })
    assert.deepEqual(r.deviation, { vsOriginal: 0.4, vsLatest: 0.167 })
    assert.deepEqual(r.estimates, [{ days: 10, date: '2026-01-05' }, { days: 12, date: '2026-01-05', reason: 'added reset' }])
    assert.deepEqual(r.assignees, [{ role: 'Backend', pct: 50 }])
  })

  it('leaves out unfinished tasks, instants and tasks without a completion day', () => {
    const recs = buildKnowledge(scenario([
      item({ id: 'open', estimates: [{ dur: 10, at: AT }] }),
      item({ id: 'ms', type: 'milestone', dur: 0, status: 'Done', completedDay: 3 }),
      item({ id: 'legacy', status: 'Done', estimates: [{ dur: 10, at: AT }] }),
    ]), ORIGIN)
    assert.deepEqual(recs, [])
  })

  it('includes unestimated tasks only when asked', () => {
    const plain = item({ id: 'old', status: 'Done', completedDay: 7 })
    assert.equal(buildKnowledge(scenario([plain]), ORIGIN).length, 0)
    const [r] = buildKnowledge(scenario([plain]), ORIGIN, { includeUnestimated: true })
    assert.equal(r.deviation, null)
    assert.deepEqual(r.estimates, [])
  })

  it('reports dependencies, their deviation and the wait they caused', () => {
    const dep = item({ id: 'api', title: 'API', startDay: -10, status: 'Done', completedDay: 4, estimates: [{ dur: 10, at: AT }] })
    const pending = item({ id: 'certs', title: 'Certs' })
    const recs = buildKnowledge(scenario([done, dep, pending], [{ id: 'e1', from: 'a', to: 'api' }, { id: 'e2', from: 'a', to: 'certs' }]), ORIGIN)
    assert.deepEqual(recs.find(r => r.id === 'api')?.dependencies, [])
    assert.deepEqual(recs.find(r => r.id === 'a')?.dependencies, [
      { id: 'api', title: 'API', type: 'task', project: 'Checkout', completed: '2026-01-09', deviation: 0.4, waitDays: 4 },
      { id: 'certs', title: 'Certs', type: 'task', project: 'Checkout', completed: null, deviation: null, waitDays: null },
    ])
  })

  it('orders records by completion date', () => {
    const early = item({ id: 'early', status: 'Done', completedDay: 5, estimates: [{ dur: 5, at: AT }] })
    assert.deepEqual(buildKnowledge(scenario([done, early]), ORIGIN).map(r => r.id), ['early', 'a'])
  })
})

describe('formats', () => {
  it('writes one JSON object per line', () => {
    const out = toJsonl(buildKnowledge(scenario([done]), ORIGIN))
    assert.equal(out.split('\n').length, 2) // one line + trailing newline
    assert.equal(JSON.parse(out.split('\n')[0]).title, 'Login')
    assert.equal(toJsonl([]), '')
  })

  it('writes Markdown in the requested language', () => {
    const md = toMarkdown(buildKnowledge(scenario([done]), ORIGIN), 'es')
    assert.match(md, /^# Base de conocimiento de estimaciones/)
    assert.match(md, /- Re-estimación: 12 d \(2026-01-05\) — added reset/)
    assert.match(md, /- Desviación: \+40% vs\. original, \+17% vs\. última/)
    assert.match(md, /Scope: login screen/)
    assert.match(toMarkdown([], 'en'), /No finished tasks/)
  })
})
