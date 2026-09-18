import type { Calendar } from '../calendar.ts'
import type { Locale, RoadmapSnapshot } from '../domain.ts'

export interface AnalysisContext {
  snapshot: RoadmapSnapshot
  calendar: Calendar
  locale: Locale
  // Day offset of "today". When set, work scheduled before it is history, not a plan to fix.
  todayDay: number | null
}
