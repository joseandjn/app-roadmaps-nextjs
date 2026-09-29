import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { LlmClient, StructuredRequest } from '../../engine/llm/types.ts'
import type { KnowledgeRecord } from './knowledge.ts'
import { rankSimilar, parseSuggestion, suggestEstimate, tokens } from './estimator.ts'

const rec = (id: string, p: Partial<KnowledgeRecord> = {}): KnowledgeRecord => ({
  id, project: { name: 'Checkout', category: 'Product' }, title: id, type: 'task', description: null,
  requiredRoles: [], assignees: [], estimates: [{ days: 10, date: '2026-01-01' }],
  start: '2026-01-01', completed: '2026-01-15', actual: { calendarDays: 14, workingDays: 10, personDays: 10 },
  deviation: { vsOriginal: 0.4, vsLatest: 0.4 }, dependencies: [], ...p,
})

function fakeLlm(reply: unknown): LlmClient & { calls: StructuredRequest[] } {
  const calls: StructuredRequest[] = []
  return { name: 'fake', calls, async completeJson(r) { calls.push(r); return reply } }
}

describe('tokens', () => {
  it('drops accents, short words and template headings', () => {
    assert.deepEqual([...tokens('Alcance: Integración de pagos con API')], ['integracion', 'pagos'])
  })
})

describe('rankSimilar', () => {
  const history = [
    rec('ui', { title: 'Pantalla de login', completed: '2026-02-01' }),
    rec('pay', { title: 'Integración pagos tarjeta', description: 'Pasarela de pagos', requiredRoles: ['Backend'] }),
    rec('old', { title: 'Pantalla de login', completed: '2026-01-01' }),
  ]

  it('puts word overlap and shared roles first', () => {
    const ranked = rankSimilar({ title: 'Integración pagos transferencia', type: 'task', requiredRoles: ['Backend'] }, history)
    assert.equal(ranked[0].id, 'pay')
  })

  it('breaks ties by most recent and leaves out the item itself', () => {
    assert.deepEqual(rankSimilar({ title: 'Pantalla de login', type: 'task' }, history).slice(0, 2).map(r => r.id), ['ui', 'old'])
    assert.equal(rankSimilar({ id: 'ui', title: 'Pantalla de login', type: 'task' }, history)[0].id, 'old')
  })

  it('caps the history', () => {
    assert.equal(rankSimilar({ title: 'x', type: 'task' }, history, 2).length, 2)
  })
})

describe('parseSuggestion', () => {
  const history = [rec('a', { title: 'A' }), rec('b', { title: 'B' })]

  it('orders the range and keeps only real references', () => {
    const s = parseSuggestion({
      optimistic: 20, likely: 12.4, pessimistic: 8, rationale: 'ok',
      references: [{ id: 'a', why: 'same' }, { id: 'ghost', why: '?' }, { id: 'a', why: 'dup' }],
    }, history)
    assert.deepEqual([s.optimistic, s.likely, s.pessimistic], [8, 12, 20])
    assert.deepEqual(s.references, [{ id: 'a', title: 'A', actualDays: 14, why: 'same' }])
  })

  it('rejects a reply without numbers', () => {
    assert.throws(() => parseSuggestion({ rationale: 'no idea' }, history), /duration range/)
  })

  it('never goes below one day', () => {
    assert.equal(parseSuggestion({ optimistic: 0, likely: -3, pessimistic: 2, references: [] }, history).optimistic, 1)
  })
})

describe('suggestEstimate', () => {
  it('sends the ranked history with team stats and returns the checked reply', async () => {
    const llm = fakeLlm({ optimistic: 10, likely: 14, pessimistic: 20, rationale: 'r', references: [{ id: 'a', why: 'w' }] })
    const s = await suggestEstimate({ title: 'Nueva', type: 'task' }, [rec('a'), rec('b', { deviation: { vsOriginal: 0, vsLatest: 0 } })], llm, 'es')
    assert.equal(s.likely, 14)
    assert.equal(s.basedOn, 2)
    assert.equal(s.model, 'fake')
    const sent = JSON.parse(llm.calls[0].user)
    assert.equal(sent.history.length, 2)
    assert.deepEqual(sent.stats, { finishedTasks: 2, withEstimate: 2, medianDeviation: 0.2 })
    assert.match(llm.calls[0].system, /Spanish/)
  })
})
