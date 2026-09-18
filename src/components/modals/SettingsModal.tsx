'use client'

import { useState } from 'react'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import { CURRENCIES } from '@/data/initialData'
import { fmtDate } from '@/lib/roadmapUtils'
import { useTranslation } from '@/lib/i18n/useTranslation'

const labelCls = 'text-[11px] font-semibold text-[#71717a] mb-1.5'
const inputCls = 'w-full text-[13px] text-[#27272a] bg-white border border-[#ececec] rounded-lg px-2.5 py-2 font-inherit'

export default function SettingsModal() {
  const { settingsOpen, settings, toggleSettings, patchSettings, addHoliday, removeHoliday } = useRoadmapStore()
  const { t } = useTranslation()
  const [newHoliday, setNewHoliday] = useState('')

  if (!settingsOpen) return null

  const isCustomCurrency = !CURRENCIES.some(c => c.code === settings.currencyCode)

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[420px] flex flex-col max-h-[90vh]">
        <div className="px-5 pt-5 pb-4 border-b border-[#ececec]">
          <h2 className="text-sm font-semibold text-[#18181b]">{t('Settings')}</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
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
        </div>

        <div className="px-5 py-4 border-t border-[#ececec] flex gap-2">
          <button onClick={toggleSettings} className="flex-1 bg-[#18181b] text-white border-none rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer font-inherit">
            {t('Close')}
          </button>
        </div>
      </div>
    </div>
  )
}
