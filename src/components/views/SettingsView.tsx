'use client'

import { SETTINGS_SECTIONS } from '@/components/settings/sections'
import { useTranslation } from '@/lib/i18n/useTranslation'

// A plain full-page tab (not a modal) that lays out the settings section
// registry — see src/components/settings/sections.ts for what "agnostic"
// means here: this component knows nothing about currency, holidays or
// roles specifically, it only renders whatever self-contained sections
// that list holds.
export default function SettingsView() {
  const { t } = useTranslation()

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
      <h1 className="text-sm font-semibold text-[#18181b] mb-4">{t('Settings')}</h1>
      <div className="max-w-[480px] flex flex-col gap-4">
        {SETTINGS_SECTIONS.map(({ id, Component }) => (
          <div key={id} className="border border-[#ececec] rounded-xl px-5 py-4 bg-[#fcfcfd]">
            <Component />
          </div>
        ))}
      </div>
    </div>
  )
}
