import type { EngineItem, RoadmapSnapshot } from '../domain.ts'

// 2026-01-05 is a Monday: day 0 = Mon, 5 = Sat, 6 = Sun, 7 = Mon...
export const ORIGIN = '2026-01-05'

export function item(id: string, startDay: number, dur: number, extra: Partial<EngineItem> = {}): EngineItem {
  return { id, projectId: 'p1', title: id, startDay, dur, status: 'Planned', type: 'task', assignments: [], ...extra }
}

export function snapshot(items: EngineItem[], deps: Array<[string, string]> = [], extra: Partial<RoadmapSnapshot> = {}): RoadmapSnapshot {
  return {
    projects: [{ id: 'p1', name: 'Proyecto Uno' }],
    resources: [{ id: 'r1', name: 'Ana' }],
    items,
    deps: deps.map(([from, to], i) => ({ id: `e${i}`, from, to })),
    settings: { countWeekends: false, holidays: [] },
    ...extra,
  }
}
