'use client'

import { useMemo, useState } from 'react'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { fmtDate, addDays, offFromStr, workingDaysInRange } from '@/lib/roadmapUtils'
import { parseTimeOff, type ImportRow } from '@/lib/timeOffImport'

const toDay = (y: number, m: number, d: number) => offFromStr(`${y}-${m}-${d}`)

const ERROR_TEXT: Record<NonNullable<ImportRow['error']>, string> = {
  person: 'Person not found (or more than one match)',
  from: 'Invalid start date',
  to: 'Invalid end date',
  order: 'End is before start',
  columns: 'Needs at least person, from and to',
}

// Bulk time off from a spreadsheet: paste rows (or load a CSV), check the
// preview, import the valid ones in one undoable step.
export default function ImportTimeOffModal({ onClose }: { onClose: () => void }) {
  const resources = useRoadmapStore(s => s.resources)
  const settings = useRoadmapStore(s => s.settings)
  const importTimeOff = useRoadmapStore(s => s.importTimeOff)
  const showToast = useRoadmapStore(s => s.showToast)
  const { t } = useTranslation()
  const [text, setText] = useState('')

  const rows = useMemo(() => {
    const existing = new Map(resources.map(r => [r.id, r.timeOff ?? []]))
    return parseTimeOff(text, resources.map(r => ({ id: r.id, name: r.name })), existing, toDay)
  }, [text, resources])
  const valid = rows.filter(r => r.status === 'ok')
  const errors = rows.filter(r => r.status === 'error').length
  const dupes = rows.filter(r => r.status === 'duplicate').length

  const loadFile = async (f: File | undefined) => { if (f) setText(await f.text()) }

  const doImport = () => {
    importTimeOff(valid.map(r => ({
      rid: r.person!.id,
      entry: { startDay: r.startDay!, dur: r.endDay! - r.startDay! + 1, note: r.note },
    })))
    showToast(t('{n} time off entries imported', { n: valid.length }))
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div role="dialog" className="bg-white rounded-2xl shadow-xl w-full max-w-[720px] max-h-[88vh] flex flex-col">
        <div className="px-5 pt-5 pb-4 border-b border-[#ececec] flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-[#18181b]">{t('Import time off')}</h2>
            <p className="text-[11px] text-[#a1a1aa] mt-0.5">
              {t('Paste rows from a spreadsheet or load a CSV. Columns: person, from, to, note (optional). Dates as YYYY-MM-DD or DD/MM/YYYY.')}
            </p>
          </div>
          <button onClick={onClose} className="text-[#a1a1aa] text-lg leading-none cursor-pointer border-none bg-transparent p-0">×</button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3 overflow-y-auto">
          <textarea
            autoFocus
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={'Ana Pérez\t03/08/2026\t14/08/2026\tVacaciones\nLuis Soto\t2026-12-21\t2026-12-31\tFin de año'}
            className="w-full h-[130px] text-[12px] font-mono text-[#27272a] border border-[#ececec] rounded-lg px-2.5 py-2 outline-none focus:border-[#c2d4ff] resize-y"
          />
          <label className="self-start text-[12px] font-semibold text-[#3b6ef5] cursor-pointer hover:underline">
            {t('Load a CSV file…')}
            <input type="file" accept=".csv,.tsv,.txt,text/csv" className="hidden" onChange={e => loadFile(e.target.files?.[0])} />
          </label>

          {rows.length > 0 && (
            <>
              <div className="flex gap-2 text-[11px] font-semibold">
                <span className="rounded-md px-2 py-1 bg-[#e8f5ec] text-[#1f7a3d]">{t('{n} to import', { n: valid.length })}</span>
                {dupes > 0 && <span className="rounded-md px-2 py-1 bg-[#f4f4f5] text-[#52525b]">{t('{n} already loaded', { n: dupes })}</span>}
                {errors > 0 && <span className="rounded-md px-2 py-1 bg-[#fdecec] text-[#b42318]">{t('{n} with errors', { n: errors })}</span>}
              </div>
              <div className="border border-[#ececec] rounded-lg overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead className="bg-[#fafafa] text-[11px] text-[#71717a]">
                    <tr>
                      <th className="text-left font-semibold px-2.5 py-1.5 w-10">#</th>
                      <th className="text-left font-semibold px-2.5 py-1.5">{t('Person')}</th>
                      <th className="text-left font-semibold px-2.5 py-1.5">{t('Dates')}</th>
                      <th className="text-left font-semibold px-2.5 py-1.5">{t('Note')}</th>
                      <th className="text-left font-semibold px-2.5 py-1.5">{t('Status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.line} className="border-t border-[#f4f4f5]" style={r.status === 'error' ? { background: '#fffafa' } : undefined}>
                        <td className="px-2.5 py-1.5 text-[#a1a1aa] tabular-nums">{r.line}</td>
                        <td className="px-2.5 py-1.5">
                          {r.person ? r.person.name : <span className="text-[#b42318]">{r.raw[0] || '—'}</span>}
                        </td>
                        <td className="px-2.5 py-1.5 whitespace-nowrap text-[#52525b]">
                          {r.startDay !== null && r.endDay !== null && r.endDay >= r.startDay
                            ? <>{fmtDate(addDays(r.startDay))} – {fmtDate(addDays(r.endDay))} <span className="text-[#a1a1aa]">· {t('{n} working days', { n: workingDaysInRange(r.startDay, r.endDay - r.startDay + 1, settings) })}</span></>
                            : <span className="text-[#b42318]">{r.raw[1] || '—'} → {r.raw[2] || '—'}</span>}
                        </td>
                        <td className="px-2.5 py-1.5 text-[#52525b] truncate max-w-[140px]">{r.note}</td>
                        <td className="px-2.5 py-1.5 whitespace-nowrap">
                          {r.status === 'ok' && <span className="text-[#1f7a3d]">{t('Ready')}</span>}
                          {r.status === 'duplicate' && <span className="text-[#71717a]">{t('Already loaded')}</span>}
                          {r.status === 'error' && <span className="text-[#b42318]">{t(ERROR_TEXT[r.error!])}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-[#ececec] flex items-center gap-2">
          <span className="text-[11px] text-[#a1a1aa]">{errors + dupes > 0 && t('Rows with errors or already loaded are skipped.')}</span>
          <button onClick={onClose} className="ml-auto border border-[#ececec] text-[#52525b] bg-white rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer font-inherit">
            {t('Cancel')}
          </button>
          <button
            onClick={doImport}
            disabled={!valid.length}
            className="bg-[#18181b] text-white border-none rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer font-inherit disabled:opacity-40 disabled:cursor-default"
          >
            {t('Import {n}', { n: valid.length })}
          </button>
        </div>
      </div>
    </div>
  )
}
