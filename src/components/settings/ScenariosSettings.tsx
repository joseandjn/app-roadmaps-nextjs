'use client'

import { useState } from 'react'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import { switchScenario, promoteScenario, updateScenarioInfo, duplicateScenario, deleteScenarioAction } from '@/lib/persistence/scenarioActions'
import { fmtDate } from '@/lib/roadmapUtils'
import { useTranslation } from '@/lib/i18n/useTranslation'
import type { ScenarioMeta } from '@/types'

const btn = 'text-[11px] font-semibold text-[#52525b] border border-[#ececec] rounded-md px-2 py-1 bg-white cursor-pointer font-inherit disabled:opacity-40 disabled:cursor-not-allowed'

// A text field that saves when it loses focus (or on Enter), and follows the
// saved value when it changes elsewhere.
function InlineField({ value, placeholder, className, onSave, ariaLabel }: { value: string; placeholder?: string; className: string; onSave: (v: string) => void; ariaLabel: string }) {
  const [text, setText] = useState(value)
  const [synced, setSynced] = useState(value)
  if (value !== synced) { setSynced(value); setText(value) }
  return (
    <input
      className={className}
      value={text}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={e => setText(e.target.value)}
      onBlur={() => { if (text.trim() !== value) onSave(text.trim()); else setText(value) }}
      onKeyDown={e => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur() }}
    />
  )
}

function ScenarioRow({ s, all }: { s: ScenarioMeta; all: ScenarioMeta[] }) {
  const { activeScenarioId, officialScenarioId, showToast } = useRoadmapStore()
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const official = s.id === officialScenarioId
  const active = s.id === activeScenarioId
  const source = all.find(x => x.id === s.basedOn)
  const canDelete = !official && all.length > 1

  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn() } finally { setBusy(false) } }
  const rename = (name: string) => {
    if (!name) { showToast(t('The name can’t be empty')); return }
    void updateScenarioInfo(s.id, { name })
  }

  return (
    <div className="bg-white border rounded-lg px-3 py-2.5 flex flex-col gap-1.5" style={{ borderColor: active ? '#d4d4d8' : '#f1f1f1' }}>
      <div className="flex items-center gap-2">
        <InlineField value={s.name} onSave={rename} ariaLabel={t('Name')}
          className="flex-1 min-w-0 text-[13px] font-semibold text-[#18181b] bg-transparent border-none outline-none font-inherit p-0" />
        {official && <span className="text-[10px] font-semibold text-white bg-[#18181b] rounded px-1.5 py-0.5 flex-none">{t('Official')}</span>}
        {active && <span className="text-[10px] font-semibold text-[#52525b] border border-[#e4e4e7] rounded px-1.5 py-0.5 flex-none">{t('Currently open')}</span>}
      </div>
      <InlineField value={s.note} placeholder={t('Add a note…')} onSave={note => void updateScenarioInfo(s.id, { note })} ariaLabel={t('Note')}
        className="w-full text-[12px] text-[#52525b] placeholder:text-[#c4c4c8] bg-transparent border-none outline-none font-inherit p-0" />
      <div className="text-[11px] text-[#a1a1aa]">
        {t('Created {date}', { date: fmtDate(new Date(s.createdAt)) })}
        {source && ` · ${t('from {name}', { name: source.name })}`}
      </div>

      {confirming ? (
        <div className="flex items-center gap-2 mt-1 p-2 rounded-md bg-[#fdf3f2] border border-[#f0d9d6]">
          <span className="flex-1 text-[12px] text-[#c0584f]">{t('Delete "{name}" and its checkpoints? This can’t be undone.', { name: s.name })}</span>
          <button className={btn} onClick={() => setConfirming(false)}>{t('Cancel')}</button>
          <button className={`${btn} !text-white !bg-[#c0584f] !border-[#c0584f]`} disabled={busy}
            onClick={() => run(async () => {
              const err = await deleteScenarioAction(s.id)
              if (err) showToast(err); else showToast(t('"{name}" deleted', { name: s.name }))
              setConfirming(false)
            })}>
            {t('Delete')}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {!active && <button className={btn} disabled={busy} onClick={() => run(() => switchScenario(s.id))}>{t('Open')}</button>}
          {!official && (
            <button className={btn} disabled={busy} onClick={() => run(async () => { await promoteScenario(s.id); showToast(t('"{name}" is now official', { name: s.name })) })}>
              {t('Make official')}
            </button>
          )}
          <button className={btn} disabled={busy} onClick={() => run(async () => {
            const copy = await duplicateScenario(s.id, t('{name} (copy)', { name: s.name }))
            showToast(copy ? t('Created "{name}"', { name: copy.name }) : t('Could not duplicate'))
          })}>
            {t('Duplicate')}
          </button>
          <button className={`${btn} ml-auto !text-[#c0584f] !border-[#f0d9d6]`} disabled={!canDelete || busy}
            title={official ? t('The official scenario can’t be deleted: make another one official first') : !canDelete ? t('The last scenario can’t be deleted') : undefined}
            onClick={() => setConfirming(true)}>
            {t('Delete')}
          </button>
        </div>
      )}
    </div>
  )
}

// Every roadmap version (scenario) in one place: rename, note, open, make
// official, duplicate, delete.
export default function ScenariosSettings() {
  const { scenarios } = useRoadmapStore()
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[12px] text-[#71717a]">{scenarios.length === 1 ? t('1 scenario') : t('{n} scenarios', { n: scenarios.length })}</span>
      {scenarios.map(s => <ScenarioRow key={s.id} s={s} all={scenarios} />)}
    </div>
  )
}
