'use client'

import { useState } from 'react'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import { createScenarioAndSwitch } from '@/lib/persistence/scenarioActions'
import { useTranslation } from '@/lib/i18n/useTranslation'

const labelCls = 'text-[11px] font-semibold text-[#71717a] mb-1.5'
const inputCls = 'w-full text-[13px] text-[#27272a] bg-white border border-[#ececec] rounded-lg px-2.5 py-2 font-inherit'

export default function ScenarioModal() {
  const { scenarioForm, scenarios, activeScenarioId, patchScenarioForm, onScenarioFormCancel } = useRoadmapStore()
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)

  if (!scenarioForm?.show) return null
  const base = scenarios.find(s => s.id === activeScenarioId)

  const save = async () => {
    if (!scenarioForm.name.trim() || saving) return
    setSaving(true)
    await createScenarioAndSwitch(scenarioForm.name.trim(), scenarioForm.note.trim())
    setSaving(false)
    onScenarioFormCancel()
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[380px] flex flex-col">
        <div className="px-5 pt-5 pb-4 border-b border-[#ececec]">
          <h2 className="text-sm font-semibold text-[#18181b]">{t('New scenario')}</h2>
          {base && <p className="text-[11px] text-[#a1a1aa] mt-1">{t('Duplicated from {name}', { name: base.name })}</p>}
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          <div>
            <div className={labelCls}>{t('Name')}</div>
            <input
              className={inputCls}
              value={scenarioForm.name}
              onChange={e => patchScenarioForm({ name: e.target.value })}
              placeholder={t('e.g. Plan B — fewer people')}
              autoFocus
            />
          </div>
          <div>
            <div className={labelCls}>{t('Note (optional)')}</div>
            <textarea
              className={`${inputCls} resize-none`}
              rows={2}
              value={scenarioForm.note}
              onChange={e => patchScenarioForm({ note: e.target.value })}
              placeholder={t('What are you testing with this scenario?')}
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-[#ececec] flex gap-2">
          <button onClick={onScenarioFormCancel} className="flex-1 border border-[#ececec] text-[#52525b] bg-white rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer font-inherit">
            {t('Cancel')}
          </button>
          <button
            onClick={save}
            disabled={!scenarioForm.name.trim() || saving}
            className="flex-1 bg-[#18181b] text-white border-none rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer font-inherit disabled:opacity-50"
          >
            {saving ? t('Creating…') : t('Create')}
          </button>
        </div>
      </div>
    </div>
  )
}
