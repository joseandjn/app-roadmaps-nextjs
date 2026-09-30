'use client'

import { useRoadmapStore } from '@/store/useRoadmapStore'
import { useTranslation } from '@/lib/i18n/useTranslation'
import HolidaysSettings from './HolidaysSettings'

const labelCls = 'text-[11px] font-semibold text-[#71717a] mb-1.5'
const inputCls = 'w-full text-[13px] text-[#27272a] bg-white border border-[#ececec] rounded-lg px-2.5 py-2 font-inherit'

// What counts as working time: hours per day, weekends and holidays.
export default function CalendarSettings() {
  const { settings, patchSettings } = useRoadmapStore()
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className={labelCls}>{t('Work hours/day')}</div>
        <input
          type="number" min={1} max={24} step={0.5}
          className={inputCls}
          value={settings.workHoursPerDay}
          onChange={e => patchSettings({ workHoursPerDay: Math.max(1, Number(e.target.value) || 1) })}
        />
      </div>

      <label className="flex items-center gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={settings.countWeekends}
          onChange={e => patchSettings({ countWeekends: e.target.checked })}
        />
        <span className="text-[13px] text-[#27272a]">{t('Count weekends as working days')}</span>
      </label>

      <div className="h-px bg-[#f1f1f1]" />
      <HolidaysSettings />
    </div>
  )
}
