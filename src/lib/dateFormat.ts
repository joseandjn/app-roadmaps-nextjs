// How dates are written across the app: in the app's language and in the
// format picked in Settings → Preferences (docs/settings-backlog.md, P1).
// Module state, set on the client once it has hydrated (useDateFormatSync):
// until then, and always on the server, it's English and 'auto' — the same
// output the server rendered, so hydration matches. Pure: tested with
// `node --test`.

export type DateLocale = 'en' | 'es'
export type DateStyle = 'auto' | 'numeric'

const MONTHS: Record<DateLocale, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
}
const WEEKDAYS: Record<DateLocale, string[]> = {
  en: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
  es: ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'],
}

let current: { locale: DateLocale; style: DateStyle } = { locale: 'en', style: 'auto' }

export function configureDates(next: Partial<{ locale: DateLocale; style: DateStyle }>): void {
  current = { ...current, ...next }
}

export function dateFormatConfig(): { locale: DateLocale; style: DateStyle } {
  return current
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const pad = (n: number) => String(n).padStart(2, '0')
const yy = (d: Date) => String(d.getFullYear()).slice(2)

// Short month name. `title` capitalizes it, for headers ("Ene", "Oct").
export function monthShort(month: number, title = false): string {
  const m = MONTHS[current.locale][month]
  return title ? cap(m) : m
}

export function weekdayShort(day: number): string {
  return WEEKDAYS[current.locale][day]
}

// "Q3" in English, "T3" (trimestre) in Spanish.
export function quarterLabel(q: number): string {
  return `${current.locale === 'es' ? 'T' : 'Q'}${q}`
}

// A day as the app shows it: "Oct 2, 26" / "2 oct 26", or numeric
// "10/02/26" / "02/10/26".
export function formatDate(d: Date, cfg: { locale: DateLocale; style: DateStyle } = current): string {
  const { locale, style } = cfg
  if (style === 'numeric') {
    return locale === 'es' ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${yy(d)}` : `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${yy(d)}`
  }
  return locale === 'es' ? `${d.getDate()} ${MONTHS.es[d.getMonth()]} ${yy(d)}` : `${MONTHS.en[d.getMonth()]} ${d.getDate()}, ${yy(d)}`
}

// A month and a day for axis ticks: "Oct 2" / "2 oct" (numeric: "10/02" / "02/10").
export function formatMonthDay(d: Date): string {
  const { locale, style } = current
  if (style === 'numeric') return locale === 'es' ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}` : `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`
  return locale === 'es' ? `${d.getDate()} ${MONTHS.es[d.getMonth()]}` : `${MONTHS.en[d.getMonth()]} ${d.getDate()}`
}
