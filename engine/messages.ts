import type { Locale } from './domain.ts'

const MONTHS: Record<Locale, string[]> = {
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}

export function fmtDate(iso: string, locale: Locale): string {
  const [y, m, d] = iso.split('-').map(Number)
  return locale === 'es' ? `${d} ${MONTHS.es[m - 1]} ${y}` : `${MONTHS.en[m - 1]} ${d}, ${y}`
}

const list = (xs: string[], locale: Locale) => {
  if (xs.length <= 1) return xs.join('')
  const and = locale === 'es' ? ' y ' : ' and '
  return xs.slice(0, -1).join(', ') + and + xs[xs.length - 1]
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

export function overloadText(
  locale: Locale,
  p: { name: string; peakPct: number; capacity: number; start: string; end: string; days: number; excess: number; items: Array<{ title: string; pct: number }> },
) {
  const items = p.items.map(i => `${i.title} (${i.pct}%)`).join(', ')
  const excess = p.excess.toFixed(1)
  // Only spelled out when it differs from the default, so full-time people read as before.
  const reduced = p.capacity < 100
  return locale === 'es'
    ? {
        title: `Sobrecarga de ${p.name}: hasta ${p.peakPct}%${reduced ? ` (disponibilidad ${p.capacity}%)` : ''}`,
        detail: `Del ${fmtDate(p.start, 'es')} al ${fmtDate(p.end, 'es')} (${p.days} ${plural(p.days, 'día laborable', 'días laborables')}) supera su ${reduced ? `disponibilidad del ${p.capacity}%` : 'capacidad'} en ${excess} persona-días. Asignado a: ${items}.`,
      }
    : {
        title: `${p.name} overloaded: up to ${p.peakPct}%${reduced ? ` (availability ${p.capacity}%)` : ''}`,
        detail: `From ${fmtDate(p.start, 'en')} to ${fmtDate(p.end, 'en')} (${p.days} working ${plural(p.days, 'day', 'days')}) it exceeds ${reduced ? `its ${p.capacity}% availability` : 'capacity'} by ${excess} person-days. Assigned to: ${items}.`,
      }
}

export function timeOffText(
  locale: Locale,
  p: { name: string; note: string | null; offStart: string; offEnd: string; start: string; end: string; days: number; personDays: number; items: Array<{ title: string; pct: number }> },
) {
  const items = p.items.map(i => `${i.title} (${i.pct}%)`).join(', ')
  const pd = p.personDays.toFixed(1)
  const sameDay = p.start === p.end
  return locale === 'es'
    ? {
        title: `${p.name} tiene trabajo asignado durante su ausencia${p.note ? ` (${p.note})` : ''}`,
        detail: `${p.name} está ausente del ${fmtDate(p.offStart, 'es')} al ${fmtDate(p.offEnd, 'es')}, pero tiene trabajo asignado ${sameDay ? `el ${fmtDate(p.start, 'es')}` : `del ${fmtDate(p.start, 'es')} al ${fmtDate(p.end, 'es')}`} (${p.days} ${plural(p.days, 'día laborable', 'días laborables')}, ${pd} persona-días sin cubrir). Asignado a: ${items}.`,
      }
    : {
        title: `${p.name} has work assigned during time off${p.note ? ` (${p.note})` : ''}`,
        detail: `${p.name} is away from ${fmtDate(p.offStart, 'en')} to ${fmtDate(p.offEnd, 'en')}, but has work assigned ${sameDay ? `on ${fmtDate(p.start, 'en')}` : `from ${fmtDate(p.start, 'en')} to ${fmtDate(p.end, 'en')}`} (${p.days} working ${plural(p.days, 'day', 'days')}, ${pd} person-days with nobody to do them). Assigned to: ${items}.`,
      }
}

export function conflictText(
  locale: Locale,
  p: { predecessor: string; successor: string; overlapDays: number; predEnd: string; succStart: string },
) {
  return locale === 'es'
    ? {
        title: `"${p.successor}" empieza antes de que termine "${p.predecessor}"`,
        detail: `"${p.successor}" depende de "${p.predecessor}", que termina el ${fmtDate(p.predEnd, 'es')}, pero empieza el ${fmtDate(p.succStart, 'es')}: se solapan ${p.overlapDays} ${plural(p.overlapDays, 'día', 'días')}.`,
      }
    : {
        title: `"${p.successor}" starts before "${p.predecessor}" ends`,
        detail: `"${p.successor}" depends on "${p.predecessor}", which ends on ${fmtDate(p.predEnd, 'en')}, but starts on ${fmtDate(p.succStart, 'en')}: they overlap by ${p.overlapDays} ${plural(p.overlapDays, 'day', 'days')}.`,
      }
}

export function cycleText(locale: Locale, p: { titles: string[] }) {
  const names = p.titles.map(t => `"${t}"`).join(', ')
  return locale === 'es'
    ? {
        title: `Dependencias circulares entre ${p.titles.length} tareas`,
        detail: `${names} se esperan unas a otras, así que ninguna puede empezar. Quedan fuera del análisis de ruta crítica hasta que se rompa el ciclo.`,
      }
    : {
        title: `Circular dependencies among ${p.titles.length} items`,
        detail: `${names} wait on each other, so none can start. They are excluded from the critical path analysis until the cycle is broken.`,
      }
}

export function criticalPathText(
  locale: Locale,
  p: {
    projects: string[]
    chain: Array<{ title: string; idleBefore: number | null }>
    end: string
    spanDays: number
    idleWorkingDays: number
    hasConflict: boolean
    atRisk: number
    overdue: number
  },
) {
  const es = locale === 'es'
  const chain = p.chain
    .map(c => c.title + (c.idleBefore ? (es ? ` (tras ${c.idleBefore} d lab. de espera)` : ` (after ${c.idleBefore} working days idle)`) : ''))
    .join(' → ')
  const notes: string[] = []
  if (es) {
    if (p.idleWorkingDays > 0) notes.push(`Hay ${p.idleWorkingDays} ${plural(p.idleWorkingDays, 'día laborable', 'días laborables')} de espera entre tareas encadenadas: margen que se podría recortar adelantando las siguientes.`)
    if (p.hasConflict) notes.push('Al menos una tarea empieza antes de que termine la que la precede.')
    if (p.atRisk) notes.push(`${p.atRisk} ${plural(p.atRisk, 'tarea en riesgo', 'tareas en riesgo')} en la cadena.`)
    if (p.overdue) notes.push(`${p.overdue} ${plural(p.overdue, 'tarea vencida', 'tareas vencidas')} sin terminar.`)
    return {
      title: `Ruta crítica de ${list(p.projects, 'es')}: termina el ${fmtDate(p.end, 'es')}`,
      detail: `${chain}. Es la cadena de dependencias que determina cuándo termina (${p.spanDays} días de extremo a extremo). ${notes.join(' ')}`.trim(),
    }
  }
  if (p.idleWorkingDays > 0) notes.push(`There are ${p.idleWorkingDays} idle working ${plural(p.idleWorkingDays, 'day', 'days')} between chained items: slack that could be cut by pulling later items forward.`)
  if (p.hasConflict) notes.push('At least one item starts before the item it depends on ends.')
  if (p.atRisk) notes.push(`${p.atRisk} at-risk ${plural(p.atRisk, 'item', 'items')} on the chain.`)
  if (p.overdue) notes.push(`${p.overdue} overdue ${plural(p.overdue, 'item', 'items')} not finished.`)
  return {
    title: `Critical path of ${list(p.projects, 'en')}: ends ${fmtDate(p.end, 'en')}`,
    detail: `${chain}. This is the dependency chain that determines when it finishes (${p.spanDays} days end to end). ${notes.join(' ')}`.trim(),
  }
}

export function idleText(
  locale: Locale,
  p: {
    name: string
    start: string
    end: string
    days: number
    cost: string | null
    before: string
    after: string
    relief: Array<{ name: string; sameRole: boolean }>
  },
) {
  const es = locale === 'es'
  const reliefNames = p.relief.map(r => (r.sameRole ? (es ? `${r.name} (mismo rol)` : `${r.name} (same role)`) : r.name))
  if (es) {
    const cost = p.cost ? ` Capacidad pagada sin uso: ${p.cost}.` : ''
    const relief = p.relief.length ? ` En esas fechas hay sobrecarga de ${list(reliefNames, 'es')}: podría tomar parte de ese trabajo.` : ''
    return {
      title: `${p.name} tiene ${p.days} días laborables libres entre "${p.before}" y "${p.after}"`,
      detail: `Del ${fmtDate(p.start, 'es')} al ${fmtDate(p.end, 'es')} no tiene trabajo asignado.${cost}${relief}`,
    }
  }
  const cost = p.cost ? ` Unused paid capacity: ${p.cost}.` : ''
  const relief = p.relief.length ? ` Over the same dates ${list(reliefNames, 'en')} ${p.relief.length === 1 ? 'is' : 'are'} overloaded, so this person could take some of that work.` : ''
  return {
    title: `${p.name} has ${p.days} free working days between "${p.before}" and "${p.after}"`,
    detail: `From ${fmtDate(p.start, 'en')} to ${fmtDate(p.end, 'en')} there is no work assigned.${cost}${relief}`,
  }
}

const MAX_NAMES = 8

export function unassignedText(
  locale: Locale,
  p: { names: string[]; start: string; end: string; days: number; cost: string | null; overloaded: string[] },
) {
  const n = p.names.length
  const es = locale === 'es'
  const shown = p.names.slice(0, MAX_NAMES)
  const more = n - shown.length
  const names = list(more > 0 ? [...shown, es ? `${more} más` : `${more} more`] : shown, locale)
  if (es) {
    const cost = p.cost ? ` Capacidad pagada sin uso: ${p.cost}.` : ''
    const overloaded = p.overloaded.length ? ` En esas fechas hay sobrecarga de ${list(p.overloaded, 'es')}: podrían tomar parte de ese trabajo.` : ''
    return {
      title: `${n} ${plural(n, 'persona sin trabajo pendiente', 'personas sin trabajo pendiente')}`,
      detail: `${names} ${plural(n, 'no tiene', 'no tienen')} tareas pendientes del ${fmtDate(p.start, 'es')} al ${fmtDate(p.end, 'es')} (${p.days} días laborables).${cost}${overloaded}`,
    }
  }
  const cost = p.cost ? ` Unused paid capacity: ${p.cost}.` : ''
  const overloaded = p.overloaded.length ? ` Over the same dates ${list(p.overloaded, 'en')} ${p.overloaded.length === 1 ? 'is' : 'are'} overloaded: they could take some of that work.` : ''
  return {
    title: `${n} ${plural(n, 'person', 'people')} with no pending work`,
    detail: `${names} ${plural(n, 'has', 'have')} no pending items from ${fmtDate(p.start, 'en')} to ${fmtDate(p.end, 'en')} (${p.days} working days).${cost}${overloaded}`,
  }
}

export function spilloverText(locale: Locale, p: { sprint: string; items: Array<{ title: string; spillDays: number }> }) {
  const n = p.items.length
  const items = p.items.map(i => `${i.title} (+${i.spillDays} d)`).join(', ')
  return locale === 'es'
    ? {
        title: `${p.sprint}: ${n} ${plural(n, 'tarea cruza', 'tareas cruzan')} el límite del sprint`,
        detail: `Caben en un sprint pero empiezan en este y terminan en el siguiente: ${items}. Considera empezarlas antes o partirlas para que cierren dentro del sprint.`,
      }
    : {
        title: `${p.sprint}: ${n} ${plural(n, 'item crosses', 'items cross')} the sprint boundary`,
        detail: `They would fit in one sprint but start in this one and end in the next: ${items}. Consider starting them earlier or splitting them so they close within the sprint.`,
      }
}

export function oversizedText(locale: Locale, p: { items: Array<{ title: string; dur: number; sprintDur: number }> }) {
  const n = p.items.length
  const items = p.items.map(i => `${i.title} (${i.dur} d)`).join(', ')
  const sprintDur = p.items[0].sprintDur
  return locale === 'es'
    ? {
        title: `${n} ${plural(n, 'tarea dura', 'tareas duran')} más que un sprint`,
        detail: `${items}: no caben en un sprint de ${sprintDur} días. Considera partirlas en entregables más pequeños o tratarlas como épicas.`,
      }
    : {
        title: `${n} ${plural(n, 'item lasts', 'items last')} longer than a sprint`,
        detail: `${items}: they do not fit in a ${sprintDur}-day sprint. Consider splitting them into smaller deliverables or treating them as epics.`,
      }
}
