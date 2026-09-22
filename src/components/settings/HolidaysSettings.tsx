'use client'

import { useState } from 'react'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import { fmtDate } from '@/lib/roadmapUtils'
import { useTranslation } from '@/lib/i18n/useTranslation'

const labelCls = 'text-[11px] font-semibold text-[#71717a] mb-1.5'
const inputCls = 'w-full text-[13px] text-[#27272a] bg-white border border-[#ececec] rounded-lg px-2.5 py-2 font-inherit'

export default function HolidaysSettings() {
  const { settings, addHoliday, removeHoliday } = useRoadmapStore()
  const { t } = useTranslation()
  const [newHoliday, setNewHoliday] = useState('')

  return (
    <div>
      <div className={labelCls}>{t('Holidays')}</div>
      <div className="flex flex-col gap-1.5 mb-2">
        {settings.holidays.map(h => (
          <div key={h} className="flex items-center gap-2 px-[9px] py-1.5 border border-[#f1f1f1] rounded-lg">
            <span className="text-[12px] text-[#27272a] flex-1">{fmtDate(new Date(`${h}T00:00:00`))}</span>
            <button onClick={() => removeHoliday(h)} className="text-[#a1a1aa] text-sm cursor-pointer border-none bg-transparent p-0">×</button>
          </div>
        ))}
        {settings.holidays.length === 0 && (
          <p className="text-[12px] text-[#a1a1aa]">—</p>
        )}
      </div>
      <div className="flex gap-2">
        <input type="date" className={inputCls} value={newHoliday} onChange={e => setNewHoliday(e.target.value)} />
        <button
          onClick={() => { if (newHoliday) { addHoliday(newHoliday); setNewHoliday('') } }}
          className="flex-none border border-[#ececec] text-[#52525b] bg-white rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer font-inherit"
        >
          {t('Add')}
        </button>
      </div>
    </div>
  )
}
