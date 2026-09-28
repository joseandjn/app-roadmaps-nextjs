import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Item } from '@/types'
import { withInitialEstimate, withCompletion, cleanDescription, estimateSummary, deviationTone } from './estimates.ts'

const AT = '2026-09-28T12:00:00.000Z'
const task = (p: Partial<Item> = {}): Item => ({ id: 'i1', projectId: 'p1', title: 'T', startDay: 100, dur: 10, status: 'Planned', type: 'task', assignments: [], ...p })

describe('withInitialEstimate', () => {
  it('records the duration a task is created with', () => {
    assert.deepEqual(withInitialEstimate(task(), AT).estimates, [{ dur: 10, at: AT }])
  })

  it('leaves instants and already-estimated items alone', () => {
    const ms = task({ type: 'milestone', dur: 0 })
    assert.equal(withInitialEstimate(ms, AT), ms)
    const est = task({ estimates: [{ dur: 5, at: 'x' }] })
    assert.equal(withInitialEstimate(est, AT), est)
  })
})

describe('withCompletion', () => {
  it('sets today on entering Done', () => {
    assert.equal(withCompletion(task(), task({ status: 'Done' }), 120).completedDay, 120)
    assert.equal(withCompletion(null, task({ status: 'Done' }), 120).completedDay, 120)
  })

  it('keeps a completion day picked in the editor', () => {
    assert.equal(withCompletion(task(), task({ status: 'Done', completedDay: 108 }), 120).completedDay, 108)
  })

  it('does not invent one for an item that was already Done', () => {
    const legacy = task({ status: 'Done' })
    assert.equal(withCompletion(legacy, { ...legacy, title: 'Renamed' }, 120).completedDay, undefined)
  })

  it('drops it on leaving Done', () => {
    const done = task({ status: 'Done', completedDay: 110 })
    const reopened = withCompletion(done, { ...done, status: 'In Progress' }, 120)
    assert.equal('completedDay' in reopened, false)
  })
})

describe('cleanDescription', () => {
  it('trims and turns blank into undefined', () => {
    assert.equal(cleanDescription('  Scope: x \n'), 'Scope: x')
    assert.equal(cleanDescription(' \n '), undefined)
    assert.equal(cleanDescription(undefined), undefined)
  })
})

describe('estimateSummary', () => {
  it('compares the actual duration with the original and latest estimates', () => {
    const it = task({ status: 'Done', completedDay: 115, estimates: [{ dur: 10, at: AT }, { dur: 12, at: AT, reason: 'scope' }] })
    const s = estimateSummary(it)
    assert.equal(s.original, 10)
    assert.equal(s.latest, 12)
    assert.equal(s.reestimates, 1)
    assert.equal(s.actual, 15)
    assert.equal(s.vsOriginal, 0.5)
    assert.equal(s.vsLatest, 0.25)
  })

  it('has no actual until the task is Done with a completion day', () => {
    assert.equal(estimateSummary(task({ completedDay: 115 })).actual, null)
    assert.equal(estimateSummary(task({ status: 'Done' })).actual, null)
    assert.equal(estimateSummary(task({ status: 'Done', completedDay: 90 })).actual, null) // before the start
  })

  it('has no deviation without estimates', () => {
    const s = estimateSummary(task({ status: 'Done', completedDay: 115 }))
    assert.equal(s.actual, 15)
    assert.equal(s.vsOriginal, null)
  })
})

describe('deviationTone', () => {
  it('grades both overruns and underruns', () => {
    assert.deepEqual([0, 0.1, -0.1, 0.2, -0.3, 0.31, -0.5].map(deviationTone), ['ok', 'ok', 'ok', 'warn', 'warn', 'bad', 'bad'])
  })
})
