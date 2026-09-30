'use client'

import { SETTINGS_SECTIONS } from '@/components/settings/sections'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import { useTranslation } from '@/lib/i18n/useTranslation'

// A plain full-page tab (not a modal): a sidebar built from the settings
// section registry, grouped under their headings, and the picked section on
// the right — see src/components/settings/sections.ts for what "agnostic"
// means here: this component knows nothing about currency, holidays or
// people specifically, it only renders whatever that list holds.
export default function SettingsView() {
  const { settingsSection, setSettingsSection } = useRoadmapStore()
  const { t } = useTranslation()
  const active = SETTINGS_SECTIONS.find(s => s.id === settingsSection) ?? SETTINGS_SECTIONS[0]
  const groups = [...new Set(SETTINGS_SECTIONS.map(s => s.group))]

  return (
    <div className="flex-1 min-h-0 flex">
      <nav className="w-[224px] flex-none border-r border-[#ececec] bg-[#fafafa] px-3 py-5 overflow-y-auto" aria-label={t('Settings')}>
        <div className="px-2 mb-5 text-sm font-semibold text-[#18181b]">{t('Settings')}</div>
        {groups.map(group => (
          <div key={group} className="mb-5">
            <div className="px-2 mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#a1a1aa]">{t(group)}</div>
            <div className="flex flex-col gap-0.5">
              {SETTINGS_SECTIONS.filter(s => s.group === group).map(({ id, label, icon: Icon }) => {
                const on = id === active.id
                return (
                  <button
                    key={id}
                    onClick={() => setSettingsSection(id)}
                    aria-current={on ? 'page' : undefined}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-[13px] cursor-pointer font-inherit border ${on
                      ? 'bg-white border-[#ececec] text-[#18181b] font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
                      : 'bg-transparent border-transparent text-[#52525b] hover:bg-[#f1f1f2] hover:text-[#27272a]'}`}
                  >
                    <Icon size={15} className={on ? 'text-[#18181b]' : 'text-[#a1a1aa]'} />
                    {t(label)}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="flex-1 min-w-0 overflow-y-auto px-8 py-6">
        <div className="max-w-[560px]">
          <h1 className="text-[15px] font-semibold text-[#18181b]">{t(active.label)}</h1>
          <p className="text-[12px] text-[#71717a] mt-1 mb-5 leading-snug">{t(active.description)}</p>
          <div className="border border-[#ececec] rounded-xl px-5 py-4 bg-[#fcfcfd]">
            <active.Component />
          </div>
        </div>
      </div>
    </div>
  )
}
