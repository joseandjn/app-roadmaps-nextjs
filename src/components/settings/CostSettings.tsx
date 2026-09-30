'use client'

import { useMemo } from 'react'
import { ArrowRight } from 'lucide-react'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import { CURRENCIES } from '@/data/initialData'
import { computeScenarioMetrics, fmtMoney } from '@/lib/roadmapUtils'
import { useTranslation } from '@/lib/i18n/useTranslation'

const labelCls = 'text-[11px] font-semibold text-[#71717a] mb-1.5'
const inputCls = 'w-full text-[13px] text-[#27272a] bg-white border border-[#ececec] rounded-lg px-2.5 py-2 font-inherit'

// How money is shown and counted, with the plan's totals at a glance. The
// full breakdown lives in the Costs tab.
export default function CostSettings() {
  const { settings, items, resources, patchSettings, setView } = useRoadmapStore()
  const { t } = useTranslation()
  const isCustomCurrency = !CURRENCIES.some(c => c.code === settings.currencyCode)
  const metrics = useMemo(() => computeScenarioMetrics({ items, resources, settings }), [items, resources, settings])

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-[#ececec] rounded-lg px-3.5 py-3">
          <div className="text-[11px] font-semibold text-[#71717a]">{t('Plan total')}</div>
          <div className="text-[18px] font-semibold text-[#18181b] mt-1 tabular-nums">{fmtMoney(metrics.totalCost, settings.currencySymbol)}</div>
        </div>
        <div className="bg-white border border-[#ececec] rounded-lg px-3.5 py-3">
          <div className="text-[11px] font-semibold text-[#71717a]">{t('People assigned')}</div>
          <div className="text-[18px] font-semibold text-[#18181b] mt-1 tabular-nums">{metrics.headcount}<span className="text-[12px] font-medium text-[#a1a1aa]"> / {resources.length}</span></div>
        </div>
      </div>
      <button onClick={() => setView('costs')} className="self-start flex items-center gap-1 text-[11px] font-semibold text-[#3b6ef5] bg-transparent border-none cursor-pointer font-inherit p-0 -mt-1 hover:underline">
        {t('See the breakdown in Costs')} <ArrowRight size={12} />
      </button>

      <div className="h-px bg-[#f1f1f1]" />

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
