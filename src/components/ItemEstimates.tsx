'use client'

import { useState } from 'react'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import { dateStr, fmtDate, addDays } from '@/lib/roadmapUtils'
import { useTodayDay } from '@/lib/useTodayDay'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { estimateSummary, deviationTone, isInstant, type DeviationTone } from '@/lib/estimates'

const labelCls = 'text-[11px] font-semibold text-[#71717a] mb-1.5'
const inputCls = 'w-full text-[13px] text-[#27272a] bg-white border border-[#ececec] rounded-lg px-2.5 py-2 font-inherit'
const linkCls = 'text-[11px] font-semibold text-[#3b6ef5] bg-transparent border-none cursor-pointer font-inherit p-0 hover:underline'

const TONE: Record<DeviationTone, { fg: string; bg: string }> = {
  ok: { fg: '#2f7d4f', bg: '#e8f5ec' },
  warn: { fg: '#9a5b00', bg: '#fdf3e2' },
  bad: { fg: '#c0584f', bg: '#fbeceb' },
}

function Deviation({ value, label }: { value: number; label: string }) {
  const tone = TONE[deviationTone(value)]
  const pct = Math.round(value * 100)
  return (
    <span className="text-[11px] font-semibold rounded-md px-1.5 py-0.5 tabular-nums" style={{ color: tone.fg, background: tone.bg }}>
      {pct > 0 ? '+' : ''}{pct}% {label}
    </span>
  )
}

// Estimate history, re-estimating and the completion day of the item being
// edited. Works on the draft: nothing is saved until the item is.
export default function ItemEstimates() {
  const { draft, draftOrig, onDraftCompleted, fitDraftToCompletion, reestimateDraft } = useRoadmapStore()
  const { t } = useTranslation()
  const todayDay = useTodayDay()
  const [form, setForm] = useState<{ dur: string; reason: string; apply: boolean } | null>(null)
  if (!draft) return null

  const instant = isInstant(draft)
  const done = draft.status === 'Done'
  const justDone = done && draftOrig?.status !== 'Done'
  const est = draft.estimates ?? []
  const sum = estimateSummary(draft)
  const end = draft.startDay + draft.dur
  const days = (n: number) => t('{n} d', { n })
  const when = (iso: string) => fmtDate(new Date(iso))

  const submit = () => {
    const n = Number(form?.dur)
    if (!form || !(n >= 1)) return
    reestimateDraft(n, form.reason, form.apply)
    setForm(null)
  }

  return (
    <>
      {!instant && (
        <div>
          <div className={labelCls}>{t('Estimate')}</div>
          {draft._new ? (
            <div className="text-[12px] text-[#a1a1aa]">{t('The initial estimate is the duration the item is created with ({n}).', { n: days(draft.dur) })}</div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {est.length === 0 && <div className="text-[12px] text-[#a1a1aa]">{t('No estimate recorded')}</div>}
              {est.map((e, i) => (
                <div key={i} className="flex items-baseline gap-2 text-[12px]">
                  <span className="text-[#71717a] w-[68px] flex-none">{i === 0 ? t('Original') : t('Re-estimate')}</span>
                  <span className="text-[#27272a] font-semibold tabular-nums whitespace-nowrap">{days(e.dur)}</span>
                  <span className="text-[#a1a1aa] text-[11px] whitespace-nowrap">{when(e.at)}</span>
                  {e.reason && <span className="text-[#52525b] text-[11px] truncate min-w-0 flex-1" title={e.reason}>· {e.reason}</span>}
                </div>
              ))}
              {sum.actual !== null && (
                <div className="flex items-baseline gap-2 text-[12px] flex-wrap">
                  <span className="text-[#71717a] w-[68px] flex-none">{t('Actual')}</span>
                  <span className="text-[#27272a] font-semibold tabular-nums whitespace-nowrap">{days(sum.actual)}</span>
                  {sum.vsOriginal !== null && <Deviation value={sum.vsOriginal} label={t('vs original')} />}
                  {sum.reestimates > 0 && sum.vsLatest !== null && <Deviation value={sum.vsLatest} label={t('vs latest')} />}
                </div>
              )}
              {form ? (
                <div className="flex flex-col gap-2 p-2.5 border border-[#ececec] rounded-lg bg-[#fafafa]">
                  <div className="flex items-center gap-2">
                    <input type="number" min={1} autoFocus value={form.dur} onChange={e => setForm({ ...form, dur: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') submit() }}
                      className="w-20 text-[13px] text-[#27272a] bg-white border border-[#ececec] rounded-lg px-2 py-1.5 font-inherit" />
                    <span className="text-[12px] text-[#71717a]">{t('calendar days')}</span>
                  </div>
                  <input className={inputCls} placeholder={t('Why? (e.g. added retry flow)')} value={form.reason}
                    onChange={e => setForm({ ...form, reason: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') submit() }} />
                  <label className="flex items-center gap-1.5 text-[12px] text-[#52525b] cursor-pointer">
                    <input type="checkbox" checked={form.apply} onChange={e => setForm({ ...form, apply: e.target.checked })} />
                    {t('Resize the bar to match')}
                  </label>
                  <div className="flex gap-2">
                    <button onClick={() => setForm(null)} className="flex-1 border border-[#ececec] text-[#52525b] bg-white rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer font-inherit">{t('Cancel')}</button>
                    <button onClick={submit} disabled={!(Number(form.dur) >= 1)} className="flex-1 bg-[#18181b] text-white border-none rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer font-inherit disabled:opacity-40">{t('Add estimate')}</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setForm({ dur: String(draft.dur), reason: '', apply: true })} className={`${linkCls} self-start`}>
                  {est.length ? t('Re-estimate') : t('Add estimate')}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {done && (
        <div>
          <div className={labelCls}>{t('Completed on')}</div>
          <input type="date" className={inputCls} value={draft.completedDay !== undefined ? dateStr(draft.completedDay) : ''} onChange={e => onDraftCompleted(e.target.value)} />
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
            {todayDay !== null && draft.completedDay !== todayDay && (
              <button onClick={() => onDraftCompleted(dateStr(todayDay))} className={linkCls}>{t('Today')}</button>
            )}
            {!instant && draft.completedDay !== end && (
              <button onClick={() => onDraftCompleted(dateStr(end))} className={linkCls}>{t('Planned end ({date})', { date: fmtDate(addDays(end)) })}</button>
            )}
            {!instant && draft.completedDay !== undefined && draft.completedDay > draft.startDay && draft.completedDay !== end && (
              <button onClick={fitDraftToCompletion} className={linkCls}>{t('Move the bar end to this date')}</button>
            )}
          </div>
          {draft.completedDay !== undefined && !instant && draft.completedDay < draft.startDay && (
            <div className="text-[11px] text-[#9a5b00] mt-1.5">{t('The completion date is before the start.')}</div>
          )}
          {justDone && (
            <div className="text-[11px] text-[#71717a] mt-1.5">{t('Add closing notes to the description: what went differently than planned.')}</div>
          )}
        </div>
      )}
    </>
  )
}
