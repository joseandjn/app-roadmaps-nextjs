'use client'

import { useRoadmapStore } from '@/store/useRoadmapStore'
import { CURRENCIES } from '@/data/initialData'
import { useTranslation } from '@/lib/i18n/useTranslation'

const labelCls = 'text-[11px] font-semibold text-[#71717a] mb-1.5'
const inputCls = 'w-full text-[13px] text-[#27272a] bg-white border border-[#ececec] rounded-lg px-2.5 py-2 font-inherit'

export default function GeneralSettings() {
  const { settings, patchSettings } = useRoadmapStore()
  const { t } = useTranslation()
  const isCustomCurrency = !CURRENCIES.some(c => c.code === settings.currencyCode)

  return (
    <div className="flex flex-col gap-4">
      <div className={labelCls}>{t('General')}</div>

      <div>
        <div className={labelCls}>{t('Work hours/day')}</div>
        <input
          type="number" min={1} max={24} step={0.5}
          className={inputCls}
          value={settings.workHoursPerDay}
          onChange={e => patchSettings({ workHoursPerDay: Math.max(1, Number(e.target.value) || 1) })}
        />
      </div>

      <div>
        <div className={labelCls}>{t('Currency')}</div>
        <select
          className={inputCls}
          value={isCustomCurrency ? 'CUSTOM' : settings.currencyCode}
          onChange={e => {
            if (e.target.value === 'CUSTOM') { patchSettings({ currencyCode: 'CUSTOM' }); return }
            const c = CURRENCIES.find(c => c.code === e.target.value)!
            patchSettings({ currencyCode: c.code, currencySymbol: c.symbol })
          }}
        >
          {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
          <option value="CUSTOM">{t('Custom')}</option>
        </select>
        {isCustomCurrency && (
          <input
            className={`${inputCls} mt-2`}
            value={settings.currencySymbol}
            onChange={e => patchSettings({ currencySymbol: e.target.value })}
            placeholder="$"
          />
        )}
      </div>

      <label className="flex items-center gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={settings.countWeekends}
          onChange={e => patchSettings({ countWeekends: e.target.checked })}
        />
        <span className="text-[13px] text-[#27272a]">{t('Count weekends as working days')}</span>
      </label>

      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={settings.timeOffReducesCost ?? false}
          onChange={e => patchSettings({ timeOffReducesCost: e.target.checked })}
        />
        <span>
          <span className="block text-[13px] text-[#27272a]">{t('Time off reduces cost')}</span>
          <span className="block text-[11px] text-[#a1a1aa] mt-0.5">{t("Off: time off is paid and costs don't change. On: a person's time-off days don't add cost to their assignments.")}</span>
        </span>
      </label>
    </div>
  )
}
