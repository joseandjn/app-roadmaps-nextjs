import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { configureDates, formatDate, formatMonthDay, monthShort, weekdayShort, quarterLabel } from './dateFormat.ts'

const oct2 = new Date(2026, 9, 2) // Friday, Oct 2 2026

afterEach(() => configureDates({ locale: 'en', style: 'auto' }))

describe('dateFormat', () => {
  it('defaults to the English format the app always had', () => {
    assert.equal(formatDate(oct2), 'Oct 2, 26')
    assert.equal(formatMonthDay(oct2), 'Oct 2')
    assert.equal(monthShort(0, true), 'Jan')
    assert.equal(weekdayShort(1), 'Mo')
    assert.equal(quarterLabel(3), 'Q3')
  })

  it('writes Spanish day-first with Spanish names', () => {
    configureDates({ locale: 'es' })
    assert.equal(formatDate(oct2), '2 oct 26')
    assert.equal(formatMonthDay(oct2), '2 oct')
    assert.equal(monthShort(0, true), 'Ene')
    assert.equal(monthShort(7), 'ago')
    assert.equal(weekdayShort(1), 'Lu')
    assert.equal(quarterLabel(3), 'T3')
  })

  it('has a numeric style in each language order', () => {
    configureDates({ style: 'numeric' })
    assert.equal(formatDate(oct2), '10/02/26')
    configureDates({ locale: 'es' })
    assert.equal(formatDate(oct2), '02/10/26')
    assert.equal(formatMonthDay(oct2), '02/10')
  })
})
