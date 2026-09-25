'use client'

import { useEffect, useRef, useState } from 'react'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { dateStr, offFromStr, workingDaysInRange } from '@/lib/roadmapUtils'
import type { TimeOff } from '@/types'

const inputCls = 'w-full text-[12px] text-[#27272a] bg-white border border-[#ececec] rounded-lg px-2 py-1.5 font-inherit'

export interface TimeOffPopoverState {
  rid: string
  entry: TimeOff
  isNew: boolean
  x: number // viewport coordinates of the pointer that opened it
  y: number
}

// Quick form for one time-off entry, opened from the Resources grid: after
// dragging over a row (new, dates prefilled) or clicking a striped band
// (edit/delete). Enter saves, Esc cancels.
export default function TimeOffPopover({ state, onClose }: { state: TimeOffPopoverState; onClose: () => void }) {
  const person = useRoadmapStore(s => s.resources.find(r => r.id === state.rid))
  const settings = useRoadmapStore(s => s.settings)
  const saveTimeOff = useRoadmapStore(s => s.saveTimeOff)
  const deleteTimeOff = useRoadmapStore(s => s.deleteTimeOff)
  const showToast = useRoadmapStore(s => s.showToast)
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  // Inclusive dates, like the resource form.
  const [from, setFrom] = useState(state.entry.startDay)
  const [to, setTo] = useState(state.entry.startDay + state.entry.dur - 1)
  const [note, setNote] = useState(state.entry.note ?? '')

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey) }
  }, [onClose])

  if (!person) return null
  const save = () => {
    saveTimeOff(state.rid, { id: state.entry.id, startDay: from, dur: to - from + 1, note })
    showToast(t('Time off saved for {name}', { name: person.name }))
    onClose()
  }
  const remove = () => {
    deleteTimeOff(state.rid, state.entry.id)
    showToast(t('Time off removed for {name}', { name: person.name }))
    onClose()
  }

  const W = 280, H = 210
  const left = Math.max(8, Math.min(state.x + 8, window.innerWidth - W - 8))
  const top = Math.max(8, Math.min(state.y + 8, window.innerHeight - H - 8))

  return (
    <div ref={ref} className="fixed z-[200] bg-white border border-[#ececec] rounded-xl shadow-[0_8px_28px_rgba(0,0,0,0.14)] p-3 flex flex-col gap-2.5"
      style={{ left, top, width: W }}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save() } }}>
      <div className="text-[12px] font-semibold text-[#18181b]">
        {state.isNew ? t('New time off') : t('Time off')} · <span className="font-medium text-[#52525b]">{person.name}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <input type="date" className={`${inputCls} min-w-0`} value={dateStr(from)} aria-label={t('From')}
          onChange={e => { if (!e.target.value) return; const d = offFromStr(e.target.value); setFrom(d); if (to < d) setTo(d) }} />
        <span className="text-[12px] text-[#a1a1aa]">→</span>
        <input type="date" className={`${inputCls} min-w-0`} value={dateStr(to)} aria-label={t('To')}
          onChange={e => { if (!e.target.value) return; setTo(Math.max(from, offFromStr(e.target.value))) }} />
      </div>
      <input autoFocus className={inputCls} value={note} onChange={e => setNote(e.target.value)} placeholder={t('Note (vacation, leave…)')} />
      <div className="text-[11px] text-[#a1a1aa]">{t('{n} working days', { n: workingDaysInRange(from, to - from + 1, settings) })}</div>
      <div className="flex gap-1.5">
        {!state.isNew && (
          <button onClick={remove} className="border border-[#f0d9d6] text-[#c0584f] bg-white rounded-lg px-2.5 py-1.5 text-[11px] font-semibold cursor-pointer font-inherit">
            {t('Remove')}
          </button>
        )}
        <button onClick={onClose} className="flex-1 border border-[#ececec] text-[#52525b] bg-white rounded-lg px-2.5 py-1.5 text-[11px] font-semibold cursor-pointer font-inherit">
          {t('Cancel')}
        </button>
        <button onClick={save} className="flex-1 bg-[#18181b] text-white border-none rounded-lg px-2.5 py-1.5 text-[11px] font-semibold cursor-pointer font-inherit">
          {t('Save')}
        </button>
      </div>
    </div>
  )
}
