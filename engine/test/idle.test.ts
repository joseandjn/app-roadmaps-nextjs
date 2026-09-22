import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { analyzeRoadmap } from '../analyze.ts'
import type { IdleCapacityFinding, UnassignedResourcesFinding } from '../findings.ts'
import { ORIGIN, item, snapshot } from './helpers.ts'

const idle = (report: ReturnType<typeof analyzeRoadmap>) => report.findings.filter((f): f is IdleCapacityFinding => f.kind === 'idle_capacity')
const unassigned = (report: ReturnType<typeof analyzeRoadmap>) => report.findings.filter((f): f is UnassignedResourcesFinding => f.kind === 'unassigned_resources')
const work = (r: string, pct = 100) => [{ r, pct }]

// Ana works days 0-4 and 14-18 (Mon-Fri of weeks 1 and 3); week 2 (days 7-11) is free.
const withGap = (extra: Parameters<typeof snapshot>[2] = {}) => snapshot(
  [item('A', 0, 5, { assignments: work('r1') }), item('B', 14, 5, { assignments: work('r1') })],
  [],
  extra,
)

describe('idle capacity', () => {
  it('finds a free stretch between two pieces of work, counting only working days', () => {
    const [f] = idle(analyzeRoadmap(withGap(), { originDate: ORIGIN }))
    assert.equal(f.evidence.idleWorkingDays, 5)
    assert.equal(f.evidence.startDay, 7)
    assert.equal(f.evidence.endDay, 11)
    assert.equal(f.evidence.startDate, '2026-01-12')
    assert.equal(f.evidence.beforeItem?.id, 'A')
    assert.equal(f.evidence.afterItem?.id, 'B')
    assert.equal(f.evidence.idleCost, null)
    assert.equal(f.severity, 'low')
    assert.match(f.title, /Ana tiene 5 días laborables libres entre "A" y "B"/)
  })

  it('ignores gaps shorter than five working days', () => {
    const snap = snapshot([item('A', 0, 5, { assignments: work('r1') }), item('B', 10, 5, { assignments: work('r1') })])
    assert.equal(idle(analyzeRoadmap(snap, { originDate: ORIGIN })).length, 0)
  })

  it('does not report time after someone\'s last item', () => {
    const snap = snapshot(
      [item('A', 0, 5, { assignments: work('r1') }), item('B', 0, 20, { assignments: work('r2') })],
      [],
      { resources: [{ id: 'r1', name: 'Ana' }, { id: 'r2', name: 'Beto' }] },
    )
    assert.equal(idle(analyzeRoadmap(snap, { originDate: ORIGIN })).length, 0)
  })

  it('prices the unused capacity from monthly and hourly rates', () => {
    const monthly = withGap({ resources: [{ id: 'r1', name: 'Ana', cost: 3044, costUnit: 'month' }], settings: { countWeekends: false, holidays: [], currencySymbol: 'S/' } })
    const report = analyzeRoadmap(monthly, { originDate: ORIGIN })
    const [f] = idle(report)
    assert.equal(f.evidence.idleCost, 500) // 3044 / 30.44 = 100 per working day x 5
    assert.equal(f.evidence.currencySymbol, 'S/')
    assert.match(f.detail, /S\/500/)
    assert.equal(report.summary.idleCost, 500)

    const hourly = withGap({ resources: [{ id: 'r1', name: 'Ana', cost: 10, costUnit: 'hour' }], settings: { countWeekends: false, holidays: [], workHoursPerDay: 6 } })
    assert.equal(idle(analyzeRoadmap(hourly, { originDate: ORIGIN }))[0].evidence.idleCost, 300) // 10 x 6h x 5 days
  })

  it('leaves the cost summary empty when nobody has a rate', () => {
    assert.equal(analyzeRoadmap(withGap(), { originDate: ORIGIN }).summary.idleCost, null)
  })

  it('groups everyone with no unfinished work into one finding', () => {
    const snap = withGap({
      resources: [
        { id: 'r1', name: 'Ana' },
        { id: 'r2', name: 'Beto', cost: 6088, costUnit: 'month' },
        { id: 'r3', name: 'Carla', cost: 3044, costUnit: 'month' },
        { id: 'r4', name: 'Dora', cost: 0, costUnit: 'month' },
      ],
      settings: { countWeekends: false, holidays: [], currencySymbol: 'S/' },
    })
    const report = analyzeRoadmap(snap, { originDate: ORIGIN })
    const [f] = unassigned(report)
    assert.equal(unassigned(report).length, 1)
    assert.equal(f.evidence.workingDays, 15)
    assert.equal(f.evidence.startDate, '2026-01-05')
    assert.equal(f.evidence.endDate, '2026-01-23')
    // Most expensive first; a rate of 0 counts as "no rate", so Dora has no cost.
    assert.deepEqual(f.evidence.people.map(p => [p.resourceName, p.idleCost]), [['Beto', 3000], ['Carla', 1500], ['Dora', null]])
    assert.equal(f.evidence.totalIdleCost, 4500)
    assert.equal(f.severity, 'low')
    assert.match(f.title, /3 personas sin trabajo pendiente/)
    assert.match(f.detail, /S\/4,500/)
    assert.equal(report.summary.idleCost, 4500)
  })

  it('does not group anyone when everybody has work', () => {
    assert.equal(unassigned(analyzeRoadmap(withGap(), { originDate: ORIGIN })).length, 0)
  })

  it('flags idle people as actionable when someone is overloaded meanwhile', () => {
    const snap = snapshot(
      [item('E1', 0, 3, { assignments: work('r2', 60) }), item('E2', 0, 3, { assignments: work('r2', 60) }), item('L', 10, 5)],
      [],
      { resources: [{ id: 'r1', name: 'Ana' }, { id: 'r2', name: 'Elvis' }] },
    )
    const [f] = unassigned(analyzeRoadmap(snap, { originDate: ORIGIN }))
    assert.equal(f.severity, 'medium')
    assert.deepEqual(f.evidence.overloadedDuring.map(o => [o.resourceName, o.overlapWorkingDays]), [['Elvis', 3]])
  })

  it('links a free window to overloaded people over the same dates', () => {
    const snap = snapshot(
      [
        item('A', 0, 5, { assignments: work('r1') }), item('B', 14, 5, { assignments: work('r1') }),
        item('E1', 7, 3, { assignments: work('r2', 60) }), item('E2', 7, 3, { assignments: work('r2', 60) }),
      ],
      [],
      { resources: [{ id: 'r1', name: 'Ana', role: 'Eng' }, { id: 'r2', name: 'Elvis', role: 'Eng' }] },
    )
    const [f] = idle(analyzeRoadmap(snap, { originDate: ORIGIN }))
    assert.equal(f.severity, 'medium')
    assert.equal(f.evidence.relief.length, 1)
    assert.equal(f.evidence.relief[0].resourceName, 'Elvis')
    assert.equal(f.evidence.relief[0].sameRole, true)
    assert.equal(f.evidence.relief[0].overlapWorkingDays, 3)
    assert.match(f.evidence.relief[0].overloadFindingId, /^overload:r2:/)
    assert.match(f.detail, /Elvis \(mismo rol\)/)
  })

  it('never suggests relief from someone whose role is known to differ', () => {
    const snap = snapshot(
      [
        item('A', 0, 5, { assignments: work('r1') }), item('B', 14, 5, { assignments: work('r1') }),
        item('E1', 7, 3, { assignments: work('r2', 60) }), item('E2', 7, 3, { assignments: work('r2', 60) }),
      ],
      [],
      { resources: [{ id: 'r1', name: 'Ana', role: 'QA' }, { id: 'r2', name: 'Elvis', role: 'Eng' }] },
    )
    const [f] = idle(analyzeRoadmap(snap, { originDate: ORIGIN }))
    assert.equal(f.evidence.relief.length, 0)
    assert.doesNotMatch(f.detail, /Elvis/)
  })

  it('still offers relief when role is unrecorded on one side', () => {
    const snap = snapshot(
      [
        item('A', 0, 5, { assignments: work('r1') }), item('B', 14, 5, { assignments: work('r1') }),
        item('E1', 7, 3, { assignments: work('r2', 60) }), item('E2', 7, 3, { assignments: work('r2', 60) }),
      ],
      [],
      { resources: [{ id: 'r1', name: 'Ana', role: 'QA' }, { id: 'r2', name: 'Elvis' }] },
    )
    const [f] = idle(analyzeRoadmap(snap, { originDate: ORIGIN }))
    assert.equal(f.evidence.relief.length, 1)
    assert.equal(f.evidence.relief[0].sameRole, false)
    assert.doesNotMatch(f.detail, /Elvis \(mismo rol\)/)
    assert.match(f.detail, /Elvis/)
  })

  it('drops a role-mismatched overloaded person from the unassigned-group finding', () => {
    const snap = snapshot(
      [item('E1', 0, 3, { assignments: work('r2', 60) }), item('E2', 0, 3, { assignments: work('r2', 60) }), item('L', 10, 5)],
      [],
      { resources: [{ id: 'r1', name: 'Ana', role: 'QA' }, { id: 'r2', name: 'Elvis', role: 'Eng' }] },
    )
    const [f] = unassigned(analyzeRoadmap(snap, { originDate: ORIGIN }))
    assert.equal(f.evidence.overloadedDuring.length, 0)
    assert.doesNotMatch(f.detail, /Elvis/)
  })

  it('excludes a candidate whose role matches the overloaded person but not the actual task', () => {
    // Elvis (role 'Eng') is overloaded on QA-only work — the old person-role heuristic would
    // have offered any idle 'Eng' as relief, which is wrong: the task itself needs QA.
    const snap = snapshot(
      [
        item('A', 0, 5, { assignments: work('r1') }), item('B', 14, 5, { assignments: work('r1') }),
        item('E1', 7, 3, { assignments: work('r2', 60), requiredRole: 'QA' }), item('E2', 7, 3, { assignments: work('r2', 60), requiredRole: 'QA' }),
      ],
      [],
      { resources: [{ id: 'r1', name: 'Ana', role: 'Eng' }, { id: 'r2', name: 'Elvis', role: 'Eng' }] },
    )
    const [f] = idle(analyzeRoadmap(snap, { originDate: ORIGIN }))
    assert.equal(f.evidence.relief.length, 0)
    assert.doesNotMatch(f.detail, /Elvis/)
  })

  it('includes a candidate whose role fits the actual task even when it differs from the overloaded person', () => {
    // Elvis (role 'Eng') is overloaded on QA-only work — the old person-role heuristic would
    // have skipped Ana even though her role is exactly what the task needs.
    const snap = snapshot(
      [
        item('A', 0, 5, { assignments: work('r1') }), item('B', 14, 5, { assignments: work('r1') }),
        item('E1', 7, 3, { assignments: work('r2', 60), requiredRole: 'QA' }), item('E2', 7, 3, { assignments: work('r2', 60), requiredRole: 'QA' }),
      ],
      [],
      { resources: [{ id: 'r1', name: 'Ana', role: 'QA' }, { id: 'r2', name: 'Elvis', role: 'Eng' }] },
    )
    const [f] = idle(analyzeRoadmap(snap, { originDate: ORIGIN }))
    assert.equal(f.evidence.relief.length, 1)
    assert.equal(f.evidence.relief[0].resourceName, 'Elvis')
    assert.equal(f.evidence.relief[0].sameRole, true)
    assert.match(f.detail, /Elvis \(mismo rol\)/)
  })

  it('ignores finished work and days before today', () => {
    const done = snapshot([item('A', 0, 5, { assignments: work('r1'), status: 'Done' }), item('B', 14, 5, { assignments: work('r1') })])
    assert.equal(idle(analyzeRoadmap(done, { originDate: ORIGIN })).length, 0)

    const past = analyzeRoadmap(withGap(), { originDate: ORIGIN, todayDay: 8 })
    assert.equal(idle(past).length, 0)
  })
})

describe('availability', () => {
  const hourly = (availability?: number) => withGap({
    resources: [{ id: 'r1', name: 'Ana', cost: 100, costUnit: 'hour', ...(availability === undefined ? {} : { availability }) }],
    settings: { countWeekends: false, holidays: [], workHoursPerDay: 8 },
  })

  it('prices idle time by the share of the person available to this roadmap', () => {
    assert.equal(idle(analyzeRoadmap(hourly(), { originDate: ORIGIN }))[0].evidence.idleCost, 4000)
    assert.equal(idle(analyzeRoadmap(hourly(50), { originDate: ORIGIN }))[0].evidence.idleCost, 2000)
  })

  it('never reports someone with 0% availability as idle', () => {
    assert.equal(idle(analyzeRoadmap(hourly(0), { originDate: ORIGIN })).length, 0)
    const snap = snapshot(
      [item('A', 0, 10, { assignments: work('r2') })],
      [],
      { resources: [{ id: 'r1', name: 'Ana', availability: 0 }, { id: 'r2', name: 'Beto' }] },
    )
    assert.equal(unassigned(analyzeRoadmap(snap, { originDate: ORIGIN })).length, 0)
  })

  it('still lists free people with reduced availability, priced by it', () => {
    const snap = snapshot(
      [item('A', 0, 10, { assignments: work('r2') })],
      [],
      {
        resources: [{ id: 'r1', name: 'Ana', cost: 100, costUnit: 'hour', availability: 50 }, { id: 'r2', name: 'Beto' }],
        settings: { countWeekends: false, holidays: [], workHoursPerDay: 8 },
      },
    )
    const [f] = unassigned(analyzeRoadmap(snap, { originDate: ORIGIN }))
    assert.deepEqual(f.evidence.people.map(p => p.resourceName), ['Ana'])
    // Days 0-9 hold 8 working days (one weekend); 100/h * 8h = 800/day, at 50% availability.
    assert.equal(f.evidence.people[0].idleCost, 8 * 800 * 0.5)
  })
})
