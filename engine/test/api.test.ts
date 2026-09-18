import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { handleAnalyzeRequest, parseAnalyzeRequest } from '../api.ts'
import type { AnalyzeResponse } from '../api.ts'
import { LlmError } from '../llm/types.ts'
import type { LlmClient, StructuredRequest } from '../llm/types.ts'
import { ORIGIN, item, snapshot } from './helpers.ts'

const overloaded = () => snapshot([
  item('A', 0, 3, { assignments: [{ r: 'r1', pct: 80 }] }),
  item('B', 0, 3, { assignments: [{ r: 'r1', pct: 80 }] }),
])
const body = (extra: Record<string, unknown> = {}) => ({ snapshot: overloaded(), originDate: ORIGIN, ...extra })

function fakeLlm(reply: unknown | (() => never)): LlmClient & { calls: StructuredRequest[] } {
  const calls: StructuredRequest[] = []
  return {
    name: 'fake:model',
    calls,
    async completeJson(req) {
      calls.push(req)
      return typeof reply === 'function' ? (reply as () => never)() : reply
    },
  }
}

describe('request validation', () => {
  const bad = (raw: unknown) => { const r = parseAnalyzeRequest(raw); assert.equal(r.ok, false); return r.ok ? '' : r.error }

  it('rejects malformed bodies', () => {
    assert.match(bad(null), /JSON object/)
    assert.match(bad({ snapshot: overloaded(), originDate: 'tomorrow' }), /originDate/)
    assert.match(bad({ originDate: ORIGIN }), /snapshot/)
    assert.match(bad(body({ locale: 'fr' })), /locale/)
    assert.match(bad(body({ todayDay: 1.5 })), /todayDay/)
  })

  it('rejects invalid items', () => {
    const withItem = (patch: object) => body({ snapshot: snapshot([{ ...item('A', 0, 3), ...patch }]) })
    assert.match(bad(withItem({ status: 'Blocked' })), /status/)
    assert.match(bad(withItem({ dur: -1 })), /dur/)
    assert.match(bad(withItem({ startDay: 'x' })), /startDay/)
    assert.match(bad(withItem({ assignments: [{ r: 'r1', pct: -5 }] })), /assignment/)
    assert.match(bad(body({ snapshot: snapshot([item('A', 0, 1), item('A', 0, 1)]) })), /Duplicate/)
  })

  it('accepts optional cost, role and sprint data and rejects bad values', () => {
    const ok = parseAnalyzeRequest(body({ snapshot: {
      ...overloaded(),
      resources: [{ id: 'r1', name: 'Ana', role: 'Eng', cost: 100, costUnit: 'hour' }],
      sprints: [{ id: 's1', name: 'S1', startDay: 0, dur: 14 }],
      settings: { countWeekends: false, holidays: [], workHoursPerDay: 6, currencySymbol: 'S/' },
    } }))
    assert.ok(ok.ok)
    assert.deepEqual(ok.value.snapshot.resources[0], { id: 'r1', name: 'Ana', role: 'Eng', cost: 100, costUnit: 'hour' })
    assert.equal(ok.value.snapshot.sprints?.length, 1)
    assert.equal(ok.value.snapshot.settings.workHoursPerDay, 6)

    const withResource = (r: object) => body({ snapshot: { ...overloaded(), resources: [{ id: 'r1', name: 'Ana', ...r }] } })
    assert.match(bad(withResource({ cost: -1 })), /cost/)
    assert.match(bad(withResource({ cost: 'lots' })), /cost/)
    assert.match(bad(body({ snapshot: { ...overloaded(), sprints: [{ id: 's', name: 'S', startDay: 0, dur: 0 }] } })), /dur/)
    assert.match(bad(body({ snapshot: { ...overloaded(), settings: { countWeekends: false, holidays: [], workHoursPerDay: 99 } } })), /workHoursPerDay/)
  })

  it('drops unknown fields instead of passing them through', () => {
    const r = parseAnalyzeRequest(body({ snapshot: { ...overloaded(), secret: 'x', items: [{ ...item('A', 0, 3), extra: 1 }] } }))
    assert.ok(r.ok)
    assert.equal('extra' in r.value.snapshot.items[0], false)
    assert.equal('secret' in r.value.snapshot, false)
  })
})

describe('handleAnalyzeRequest', () => {
  it('returns 400 with the validation error', async () => {
    const res = await handleAnalyzeRequest({}, { llm: null })
    assert.equal(res.status, 400)
    assert.ok('error' in res.body)
  })

  it('returns the deterministic report without touching the LLM by default', async () => {
    const llm = fakeLlm({})
    const res = await handleAnalyzeRequest(body(), { llm })
    const out = res.body as AnalyzeResponse
    assert.equal(res.status, 200)
    assert.equal(out.summary.overloadedResources, 1)
    assert.equal(out.narrative, null)
    assert.equal(out.narrativeError, null)
    assert.equal(llm.calls.length, 0)
  })

  it('adds a narrative and drops priorities that cite unknown findings', async () => {
    const llm = fakeLlm({
      summary: '  Ana está sobrecargada.  ',
      priorities: [
        { findingId: 'overload:r1:0-2', why: 'Supera su capacidad.', action: 'Mover B.' },
        { findingId: 'made-up-id', why: 'x', action: 'y' },
        { findingId: 'overload:r1:0-2', why: 1, action: 'y' },
      ],
    })
    const res = await handleAnalyzeRequest(body({ narrate: true }), { llm })
    const out = res.body as AnalyzeResponse
    assert.equal(out.narrative?.summary, 'Ana está sobrecargada.')
    assert.deepEqual(out.narrative?.priorities.map(p => p.findingId), ['overload:r1:0-2'])
    assert.equal(out.narrative?.model, 'fake:model')
    assert.equal(out.narrativeError, null)
  })

  it('sends the findings as ground truth and the requested language to the model', async () => {
    const llm = fakeLlm({ summary: 's', priorities: [] })
    await handleAnalyzeRequest(body({ narrate: true, locale: 'en' }), { llm })
    assert.match(llm.calls[0].system, /Write in English/)
    assert.match(llm.calls[0].user, /overload:r1:0-2/)
  })

  it('still returns the findings when the LLM fails', async () => {
    const llm = fakeLlm(() => { throw new LlmError('Ollama is down') })
    const res = await handleAnalyzeRequest(body({ narrate: true }), { llm })
    const out = res.body as AnalyzeResponse
    assert.equal(res.status, 200)
    assert.equal(out.narrative, null)
    assert.equal(out.narrativeError, 'Ollama is down')
    assert.equal(out.findings.length, 1)
  })

  it('reports a malformed model reply as a narrative error', async () => {
    const res = await handleAnalyzeRequest(body({ narrate: true }), { llm: fakeLlm({ nope: true }) })
    assert.match((res.body as AnalyzeResponse).narrativeError ?? '', /unexpected shape/)
  })

  it('explains when no LLM is configured', async () => {
    const res = await handleAnalyzeRequest(body({ narrate: true }), { llm: null })
    assert.match((res.body as AnalyzeResponse).narrativeError ?? '', /No LLM provider/)
  })

  it('skips the LLM when there is nothing to explain', async () => {
    const llm = fakeLlm({})
    const res = await handleAnalyzeRequest({ snapshot: snapshot([item('A', 0, 3)]), originDate: ORIGIN, narrate: true }, { llm })
    assert.equal((res.body as AnalyzeResponse).findings.length, 0)
    assert.equal(llm.calls.length, 0)
  })
})
