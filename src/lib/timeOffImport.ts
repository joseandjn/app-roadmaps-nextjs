// Parses time off pasted from a spreadsheet (or a CSV file) into rows ready
// to preview and import. Pure: no store, no React, no app imports, so it can
// be run on its own. Columns: person, from, to, note (note optional).

export interface ImportPerson { id: string; name: string }
export interface ImportRange { startDay: number; dur: number; note?: string }

export type ImportRowStatus = 'ok' | 'duplicate' | 'error'

export interface ImportRow {
  line: number // 1-based line in the pasted text
  raw: string[]
  person: ImportPerson | null
  startDay: number | null
  endDay: number | null // inclusive
  note: string
  status: ImportRowStatus
  error?: 'person' | 'from' | 'to' | 'order' | 'columns'
}

// Lowercase, accents and punctuation stripped, spaces collapsed, so
// "Soto, Luis" and "luis soto" compare equal word by word.
function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[.,;]/g, ' ').replace(/\s+/g, ' ').trim()
}

// Tab (spreadsheet paste) wins; otherwise whichever of ; or , appears more.
function detectSeparator(lines: string[]): string {
  const sample = lines.slice(0, 5).join('\n')
  if (sample.includes('\t')) return '\t'
  const semis = (sample.match(/;/g) ?? []).length
  const commas = (sample.match(/,/g) ?? []).length
  return semis > commas ? ';' : ','
}

// Splits one line, honoring double quotes ("Pérez, Ana").
function splitLine(line: string, sep: string): string[] {
  const out: string[] = []
  let cur = '', quoted = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++ } else quoted = !quoted
    } else if (c === sep && !quoted) { out.push(cur); cur = '' } else cur += c
  }
  out.push(cur)
  return out.map(s => s.trim())
}

// YYYY-MM-DD, or DD/MM/YYYY (also with - or .), as a day offset via toDay.
// Returns null for anything else or an impossible date.
export function parseDate(s: string, toDay: (y: number, m: number, d: number) => number): number | null {
  let y: number, m: number, d: number
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s)
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s)
  if (iso) { y = +iso[1]; m = +iso[2]; d = +iso[3] }
  else if (dmy) { d = +dmy[1]; m = +dmy[2]; y = +dmy[3] }
  else return null
  const probe = new Date(y, m - 1, d)
  if (probe.getFullYear() !== y || probe.getMonth() !== m - 1 || probe.getDate() !== d) return null
  return toDay(y, m, d)
}

// Exact name first; otherwise a unique person whose name contains every
// word typed ("ana" alone is ambiguous if there are two Anas).
export function matchPerson(text: string, people: ImportPerson[]): ImportPerson | null {
  const q = norm(text)
  if (!q) return null
  const exact = people.filter(p => norm(p.name) === q)
  if (exact.length === 1) return exact[0]
  const words = q.split(' ')
  const partial = people.filter(p => { const n = norm(p.name); return words.every(w => n.includes(w)) })
  return partial.length === 1 ? partial[0] : null
}

export function parseTimeOff(
  text: string,
  people: ImportPerson[],
  existing: Map<string, ImportRange[]>, // current time off by person id, to flag duplicates
  toDay: (y: number, m: number, d: number) => number,
): ImportRow[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const nonEmpty = lines.filter(l => l.trim())
  if (!nonEmpty.length) return []
  const sep = detectSeparator(nonEmpty)

  const rows: ImportRow[] = []
  const seen = new Set<string>() // person|start|end within this paste
  lines.forEach((line, i) => {
    if (!line.trim()) return
    const raw = splitLine(line, sep)
    // A header: neither date column parses. Only skipped on the first line.
    if (!rows.length && raw.length >= 3 && parseDate(raw[1], toDay) === null && parseDate(raw[2], toDay) === null && !/\d/.test(raw[1] + raw[2])) return

    const row: ImportRow = { line: i + 1, raw, person: null, startDay: null, endDay: null, note: raw.slice(3).join(' ').trim(), status: 'ok' }
    if (raw.length < 3) { rows.push({ ...row, status: 'error', error: 'columns' }); return }
    row.person = matchPerson(raw[0], people)
    row.startDay = parseDate(raw[1], toDay)
    row.endDay = parseDate(raw[2], toDay)
    if (!row.person) row.error = 'person'
    else if (row.startDay === null) row.error = 'from'
    else if (row.endDay === null) row.error = 'to'
    else if (row.endDay < row.startDay) row.error = 'order'
    if (row.error) { rows.push({ ...row, status: 'error' }); return }

    const key = `${row.person!.id}|${row.startDay}|${row.endDay}`
    const dur = row.endDay! - row.startDay! + 1
    const already = (existing.get(row.person!.id) ?? []).some(o => o.startDay === row.startDay && o.dur === dur)
    if (already || seen.has(key)) row.status = 'duplicate'
    seen.add(key)
    rows.push(row)
  })
  return rows
}
