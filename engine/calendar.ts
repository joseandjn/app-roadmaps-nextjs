import type { EngineSettings } from './domain.ts'

const DAY_MS = 86_400_000
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

// Pure UTC arithmetic on calendar dates, so results never depend on the
// host's timezone or DST.
export function parseIsoDate(iso: string): number | null {
  const m = ISO_DATE.exec(iso)
  if (!m) return null
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3])
  const d = new Date(ms)
  const valid = d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3]
  return valid ? ms : null
}

export interface Calendar {
  isWorking(day: number): boolean
  toIso(day: number): string
}

export function createCalendar(originIso: string, settings: EngineSettings): Calendar {
  const originMs = parseIsoDate(originIso)
  if (originMs === null) throw new Error(`Invalid origin date: ${originIso}`)
  const originWeekday = new Date(originMs).getUTCDay()

  const holidayDays = new Set<number>()
  for (const h of settings.holidays) {
    const ms = parseIsoDate(h)
    if (ms !== null) holidayDays.add(Math.round((ms - originMs) / DAY_MS))
  }

  return {
    isWorking(day) {
      if (!settings.countWeekends) {
        const wd = (((originWeekday + day) % 7) + 7) % 7
        if (wd === 0 || wd === 6) return false
      }
      return !holidayDays.has(day)
    },
    toIso(day) {
      return new Date(originMs + day * DAY_MS).toISOString().slice(0, 10)
    },
  }
}
