'use client'

import { usePreferences } from '@/lib/preferences'
import { formatDate, type DateStyle } from '@/lib/dateFormat'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { getTodayDay } from '@/data/initialData'
import { addDays } from '@/lib/roadmapUtils'

const labelCls = 'text-[11px] font-semibold text-[#71717a] mb-1.5'
const inputCls = 'w-full text-[13px] text-[#27272a] bg-white border border-[#ececec] rounded-lg px-2.5 py-2 font-inherit'

const STYLES: { value: DateStyle; label: string; hint: string }[] = [
  { value: 'auto', label: 'By language', hint: 'Month in letters, in the app’s language.' },
  { value: 'numeric', label: 'Numeric', hint: 'Day, month and year in numbers.' },
]

// Language and date format: personal, saved in this browser only.
export default function FormatSettings() {
  const { t, locale, setLocale } = useTranslation()
  const { dateStyle, setDateStyle } = usePreferences()
  const today = addDays(getTodayDay())

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className={labelCls}>{t('Language')}</div>
        <select className={inputCls} value={locale} onChange={e => setLocale(e.target.value as typeof locale)}>
          <option value="es">Español</option>
          <option value="en">English</option>
        </select>
      </div>

      <div>
        <div className={labelCls}>{t('Date format')}</div>
        <div className="flex flex-col gap-1.5">
          {STYLES.map(s => (
            <label key={s.value} className="flex items-center gap-2.5 px-3 py-2 bg-white border rounded-lg cursor-pointer" style={{ borderColor: dateStyle === s.value ? '#18181b' : '#ececec' }}>
              <input type="radio" name="date-style" checked={dateStyle === s.value} onChange={() => setDateStyle(s.value)} />
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] text-[#27272a]">{t(s.label)}</span>
                <span className="block text-[11px] text-[#a1a1aa]">{t(s.hint)}</span>
              </span>
              <span className="text-[12px] font-semibold text-[#52525b] tabular-nums">{formatDate(today, { locale, style: s.value })}</span>
            </label>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-[#a1a1aa] m-0">{t('These preferences are saved in this browser only; they don’t change the plan for anyone else.')}</p>
    </div>
  )
}
