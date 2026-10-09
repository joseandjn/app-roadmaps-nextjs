'use client'

import { useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import { exportScenarios, importBackup } from '@/lib/persistence/backupActions'
import { switchScenario } from '@/lib/persistence/scenarioActions'
import { parseBackup, type BackupFile } from '@/lib/backup'
import { useTranslation } from '@/lib/i18n/useTranslation'
import type { ScenarioMeta } from '@/types'

const labelCls = 'text-[11px] font-semibold text-[#71717a] mb-1.5'
const btn = 'flex items-center justify-center gap-1.5 border border-[#ececec] text-[#52525b] bg-white rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer font-inherit disabled:opacity-40 disabled:cursor-not-allowed'
const primary = 'flex items-center justify-center gap-1.5 bg-[#18181b] text-white border-none rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer font-inherit disabled:opacity-40 disabled:cursor-not-allowed'

// Download roadmaps as a file, and bring one back as a new roadmap.
export default function BackupSettings() {
  const { scenarios, activeScenarioId, showToast } = useRoadmapStore()
  const { t } = useTranslation()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [picked, setPicked] = useState<{ file: string; backup: BackupFile } | null>(null)
  const [error, setError] = useState<{ text: string; detail?: string } | null>(null)
  const [created, setCreated] = useState<ScenarioMeta[]>([])
  const active = scenarios.find(s => s.id === activeScenarioId)

  const download = async (ids: string[]) => {
    setBusy(true)
    try { showToast(t('Downloaded {file}', { file: await exportScenarios(ids) })) }
    catch (e) { showToast(`${t('Could not export')}: ${(e as Error).message}`) }
    finally { setBusy(false) }
  }

  const onFile = async (f: File | undefined) => {
    setError(null); setPicked(null); setCreated([])
    if (!f) return
    const parsed = parseBackup(await f.text(), f.name)
    if (parsed.ok) setPicked({ file: f.name, backup: parsed.backup })
    else setError({ text: parsed.error, detail: parsed.detail })
    if (fileRef.current) fileRef.current.value = ''
  }

  const doImport = async () => {
    if (!picked) return
    setBusy(true)
    try {
      const made = await importBackup(picked.backup, t('(imported)'))
      setCreated(made)
      setPicked(null)
      showToast(made.length === 1 ? t('Imported "{name}"', { name: made[0].name }) : t('Imported {n} roadmaps', { n: made.length }))
    } catch (e) {
      setError({ text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className={labelCls}>{t('Export')}</div>
        <p className="text-[11px] text-[#a1a1aa] mb-2">{t('A JSON file with the roadmap’s projects, tasks, people, dependencies, sprints and settings. Keep it somewhere safe.')}</p>
        <div className="flex flex-wrap gap-2">
          <button className={primary} disabled={busy || !active} onClick={() => active && download([active.id])}>
            <Download size={13} /> {t('Download "{name}"', { name: active?.name ?? '' })}
          </button>
          {scenarios.length > 1 && (
            <button className={btn} disabled={busy} onClick={() => download(scenarios.map(s => s.id))}>
              <Download size={13} /> {t('Download all ({n})', { n: scenarios.length })}
            </button>
          )}
        </div>
      </div>

      <div className="h-px bg-[#f1f1f1]" />

      <div>
        <div className={labelCls}>{t('Import')}</div>
        <p className="text-[11px] text-[#a1a1aa] mb-2">{t('Each roadmap in the file is added as a new one; nothing existing is replaced.')}</p>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
        <button className={btn} disabled={busy} onClick={() => fileRef.current?.click()}>
          <Upload size={13} /> {t('Choose file…')}
        </button>

        {error && <p className="text-[12px] text-[#c0584f] mt-2 mb-0" title={error.detail}>{t('Could not read the file')}: {t(error.text)}</p>}

        {picked && (
          <div className="mt-3 p-3 rounded-lg bg-white border border-[#ececec] flex flex-col gap-2">
            <div className="text-[12px] text-[#52525b]">{t('{file} — will create:', { file: picked.file })}</div>
            <ul className="m-0 pl-4 text-[12px] text-[#27272a] leading-relaxed">
              {picked.backup.scenarios.map((s, i) => (
                <li key={i}>
                  <span className="font-semibold">{s.name} {t('(imported)')}</span>
                  <span className="text-[#a1a1aa]"> · {t('{p} projects, {i} tasks, {r} people', { p: s.data.projects.length, i: s.data.items.length, r: s.data.resources.length })}</span>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <button className={btn} onClick={() => setPicked(null)}>{t('Cancel')}</button>
              <button className={primary} disabled={busy} onClick={doImport}>
                {picked.backup.scenarios.length === 1 ? t('Import') : t('Import {n}', { n: picked.backup.scenarios.length })}
              </button>
            </div>
          </div>
        )}

        {created.length > 0 && (
          <div className="mt-3 flex flex-col gap-1.5">
            {created.map(s => (
              <div key={s.id} className="flex items-center gap-2 text-[12px] text-[#27272a]">
                <span className="flex-1 truncate">✓ {s.name}</span>
                <button className="text-[11px] font-semibold text-[#3b6ef5] bg-transparent border-none cursor-pointer font-inherit p-0 hover:underline" onClick={() => switchScenario(s.id)}>{t('Open')}</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
