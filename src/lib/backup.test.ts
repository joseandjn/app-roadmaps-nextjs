import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { ScenarioData } from '@/types'
import { buildBackup, backupFileName, parseBackup, scenarioDataProblem } from './backup.ts'

const data = (): ScenarioData => ({
  projects: [{ id: 'p1', name: 'Checkout', desc: '', owner: 'r1', category: 'Product', color: '#000', status: 'Planned' }],
  items: [{ id: 'i1', projectId: 'p1', title: 'Login', startDay: 0, dur: 5, status: 'Planned', type: 'task', assignments: [] }],
  resources: [{ id: 'r1', name: 'Ana', role: 'Backend', cost: 1, costUnit: 'month' }],
  deps: [],
  sprints: [],
  settings: { workHoursPerDay: 8, currencyCode: 'USD', currencySymbol: '$', countWeekends: false, holidays: [] },
  roles: [],
})

describe('backup', () => {
  it('round-trips through JSON', () => {
    const b = buildBackup([{ name: 'Roadmap 2027', note: 'n', data: data() }], '2026-10-09T10:00:00.000Z')
    const parsed = parseBackup(JSON.stringify(b))
    assert.equal(parsed.ok, true)
    if (parsed.ok) assert.deepEqual(parsed.backup, b)
  })

  it('names the file after the scenario, or "backup" for several', () => {
    const one = buildBackup([{ name: 'Roadmap 2027 — Plan B', note: '', data: data() }], '2026-10-09T10:00:00.000Z')
    assert.equal(backupFileName(one), 'roadmap-roadmap-2027-plan-b-2026-10-09.json')
    const two = buildBackup([one.scenarios[0], one.scenarios[0]], '2026-10-09T10:00:00.000Z')
    assert.equal(backupFileName(two), 'roadmap-backup-2026-10-09.json')
  })

  it('accepts a bare scenario file, named after the file', () => {
    const parsed = parseBackup(JSON.stringify(data()), 's-original.json')
    assert.equal(parsed.ok, true)
    if (parsed.ok) assert.equal(parsed.backup.scenarios[0].name, 's-original')
  })

  it('rejects broken files with a reason', () => {
    const bad = (text: string) => { const p = parseBackup(text); return p.ok ? 'ok' : `${p.error} ${p.detail ?? ''}` }
    assert.match(bad('not json'), /not valid JSON/)
    assert.match(bad('{"format":"roadmap-backup","version":1,"scenarios":[]}'), /no scenarios/)
    assert.match(bad('{"format":"roadmap-backup","version":99,"scenarios":[{}]}'), /newer version/)
    assert.match(bad(JSON.stringify({ format: 'roadmap-backup', version: 1, scenarios: [{ name: 'X', data: { ...data(), items: [{ id: 'i' }] } }] })), /"X": a task is missing/)
    assert.match(bad('{"hello":1}'), /not a roadmap backup/)
  })

  it('points at the first problem in scenario data', () => {
    assert.equal(scenarioDataProblem(data()), null)
    assert.equal(scenarioDataProblem({ ...data(), settings: null }), 'settings is missing')
    assert.equal(scenarioDataProblem({ ...data(), deps: [{ id: 'e', from: 'a' }] }), 'a dependency is invalid')
  })
})
