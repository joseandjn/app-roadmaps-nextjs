import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createCalendar, parseIsoDate } from '../calendar.ts'
import { ORIGIN } from './helpers.ts'

describe('calendar', () => {
  it('skips weekends and holidays', () => {
    const cal = createCalendar(ORIGIN, { countWeekends: false, holidays: ['2026-01-08'] })
    assert.deepEqual([0, 3, 4, 5, 6, 7].map(d => cal.isWorking(d)), [true, false, true, false, false, true])
  })

  it('counts weekends when asked to', () => {
    const cal = createCalendar(ORIGIN, { countWeekends: true, holidays: [] })
    assert.equal(cal.isWorking(5), true)
    assert.equal(cal.isWorking(6), true)
  })

  it('handles days before the origin', () => {
    const cal = createCalendar(ORIGIN, { countWeekends: false, holidays: [] })
    assert.equal(cal.isWorking(-1), false) // Sunday 2026-01-04
    assert.equal(cal.isWorking(-3), true) // Friday 2026-01-02
    assert.equal(cal.toIso(-3), '2026-01-02')
  })

  it('converts offsets to ISO dates across month and year boundaries', () => {
    const cal = createCalendar(ORIGIN, { countWeekends: true, holidays: [] })
    assert.equal(cal.toIso(0), '2026-01-05')
    assert.equal(cal.toIso(27), '2026-02-01')
    assert.equal(cal.toIso(360), '2026-12-31')
    assert.equal(cal.toIso(361), '2027-01-01')
  })

  it('rejects impossible dates', () => {
    assert.equal(parseIsoDate('2026-02-30'), null)
    assert.equal(parseIsoDate('26-01-05'), null)
    assert.throws(() => createCalendar('nope', { countWeekends: true, holidays: [] }))
  })
})
