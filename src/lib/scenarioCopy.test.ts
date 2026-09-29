import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Item, ScenarioData } from '@/types'
import { buildCopyPayload, applyCopy, isCopyPayload } from './scenarioCopy.ts'

const item = (id: string, p: Partial<Item> = {}): Item => ({ id, projectId: 'p1', title: id, startDay: 0, dur: 5, status: 'Planned', type: 'task', assignments: [], ...p })
const project = (id: string) => ({ id, name: `Project ${id}`, desc: '', owner: 'r1', category: 'Product', color: '#000', status: 'Planned' as const })
const person = (id: string, role = 'Backend') => ({ id, name: `Person ${id}`, role, cost: 1, costUnit: 'month' as const })
const scenario = (p: Partial<ScenarioData>): ScenarioData => ({
  projects: [project('p1')], items: [], resources: [person('r1')], deps: [], sprints: [],
  settings: { workHoursPerDay: 8, currencyCode: 'USD', currencySymbol: '$', countWeekends: false, holidays: [] },
  roles: [{ name: 'Backend', icon: 'server' }], ...p,
})

// Source: the original scenario plus a new project, person and role.
const source = scenario({
  projects: [project('p1'), project('p2')],
  resources: [person('r1'), person('r2', 'QA')],
  roles: [{ name: 'Backend', icon: 'server' }, { name: 'QA', icon: 'bug' }],
  items: [
    item('old', { title: 'Old task edited', dur: 9, lane: 2 }),
    item('new', { projectId: 'p2', title: 'New task', assignments: [{ r: 'r2', pct: 50 }], requiredRoles: ['QA'] }),
    item('keep', { title: 'Not selected' }),
    item('elsewhere', { title: 'Only in source' }),
  ],
  deps: [
    { id: 'e1', from: 'new', to: 'old' },
    { id: 'e2', from: 'new', to: 'elsewhere' },
    { id: 'e3', from: 'keep', to: 'new' },
  ],
})

// Target: duplicated before the new work; the old task has its own dependency.
const target = scenario({
  items: [item('old', { title: 'Old task' }), item('keep', { title: 'Not selected' }), item('other', { title: 'Other' })],
  deps: [{ id: 'e1', from: 'old', to: 'other' }, { id: 'e9', from: 'keep', to: 'old' }],
})

describe('buildCopyPayload', () => {
  it('takes the tasks with what they need', () => {
    const p = buildCopyPayload(source, ['old', 'new'])
    assert.deepEqual(p.items.map(i => i.id), ['old', 'new'])
    assert.deepEqual(p.deps.map(e => e.id), ['e1', 'e2']) // their own "Depends on", not e3
    assert.deepEqual(p.projects.map(x => x.id), ['p1', 'p2'])
    assert.deepEqual(p.resources.map(x => x.id), ['r2'])
    assert.deepEqual(p.roles.map(x => x.name).sort(), ['QA'])
  })
})

describe('applyCopy', () => {
  const { data, summary } = applyCopy(target, buildCopyPayload(source, ['old', 'new']))

  it('replaces existing tasks and adds new ones', () => {
    assert.deepEqual(data.items.map(i => [i.id, i.title]), [['old', 'Old task edited'], ['keep', 'Not selected'], ['other', 'Other'], ['new', 'New task']])
    assert.equal(data.items[0].lane, 2)
    assert.deepEqual(summary.added, ['New task'])
    assert.deepEqual(summary.replaced, ['Old task edited'])
  })

  it('adds only the projects, people and roles the target is missing', () => {
    assert.deepEqual(data.projects.map(p => p.id), ['p1', 'p2'])
    assert.deepEqual(data.resources.map(r => r.id), ['r1', 'r2'])
    assert.deepEqual(data.roles.map(r => r.name), ['Backend', 'QA'])
    assert.deepEqual(summary.projectsAdded, ['Project p2'])
    assert.deepEqual(summary.resourcesAdded, ['Person r2'])
    assert.deepEqual(summary.rolesAdded, ['QA'])
  })

  it("replaces a copied task's dependencies and drops the ones it can't keep", () => {
    // old → other is gone (old was replaced, and the source's old depends on nothing);
    // keep → old stays; new → old is added with a fresh id since e1 was taken.
    assert.deepEqual(data.deps.map(e => [e.from, e.to]), [['keep', 'old'], ['new', 'old']])
    assert.notEqual(data.deps[1].id, 'e9')
    assert.equal(new Set(data.deps.map(e => e.id)).size, data.deps.length)
    assert.equal(summary.depsAdded, 1)
    assert.deepEqual(summary.depsDropped, [{ from: 'New task', to: 'Only in source' }])
  })

  it('does not modify the target it was given', () => {
    assert.equal(target.items[0].title, 'Old task')
    assert.equal(target.deps.length, 2)
  })

  it('is idempotent: copying the same tasks again only replaces', () => {
    const again = applyCopy(data, buildCopyPayload(source, ['old', 'new']))
    assert.deepEqual(again.data.items.map(i => i.id), data.items.map(i => i.id))
    assert.deepEqual(again.summary.added, [])
    assert.equal(again.data.deps.length, data.deps.length)
  })
})

describe('isCopyPayload', () => {
  it('accepts a built payload and rejects broken ones', () => {
    assert.equal(isCopyPayload(buildCopyPayload(source, ['new'])), true)
    assert.equal(isCopyPayload(buildCopyPayload(source, [])), false) // nothing to copy
    assert.equal(isCopyPayload({ items: [{ id: 'x' }], deps: [], depTitles: {}, projects: [], resources: [], roles: [] }), false)
    assert.equal(isCopyPayload(null), false)
  })
})
