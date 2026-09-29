'use client'

import { useEffect, useState } from 'react'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { previewCopy, copySelectionTo } from '@/lib/persistence/copyActions'
import { switchScenario } from '@/lib/persistence/scenarioActions'
import type { CopySummary } from '@/lib/scenarioCopy'

const btn = 'flex-1 border border-[#ececec] text-[#52525b] bg-white rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer font-inherit'
const primary = 'flex-1 bg-[#18181b] text-white border-none rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer font-inherit disabled:opacity-40 disabled:cursor-default'

// "Copy to…": pick another scenario, see what the copy will do, confirm.
// Mounted only while open, so every opening starts from a clean state.
export default function CopyToScenarioModal() {
  const copyOpen = useRoadmapStore(s => s.copyOpen)
  return copyOpen ? <CopyDialog /> : null
}

function CopyDialog() {
  const { selectedIds, scenarios, activeScenarioId, closeCopy, showToast } = useRoadmapStore()
  const { t } = useTranslation()
  const [targetId, setTargetId] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ summary: CopySummary | null; error: string | null; loading: boolean }>({ summary: null, error: null, loading: false })
  const [copying, setCopying] = useState(false)
  const [done, setDone] = useState<{ targetId: string; summary: CopySummary } | null>(null)

  const pick = (id: string) => {
    setTargetId(id)
    setPreview({ summary: null, error: null, loading: true })
  }
  useEffect(() => {
    if (!targetId) return
    const ctrl = new AbortController()
    previewCopy(targetId, ctrl.signal)
      .then(summary => setPreview({ summary, error: null, loading: false }))
      .catch(err => { if (!ctrl.signal.aborted) setPreview({ summary: null, error: (err as Error).message, loading: false }) })
    return () => ctrl.abort()
  }, [targetId])
  const targets = scenarios.filter(s => s.id !== activeScenarioId)
  const source = scenarios.find(s => s.id === activeScenarioId)
  const targetName = scenarios.find(s => s.id === targetId)?.name ?? ''

  const copy = async () => {
    if (!targetId || copying) return
    setCopying(true)
    try {
      const summary = await copySelectionTo(targetId, t('Before copying from {name}', { name: source?.name ?? '' }))
      setDone({ targetId, summary })
      // Done with this selection; the modal stays open to show the result.
      useRoadmapStore.setState({ selectedIds: [] })
    } catch (err) {
      showToast(`${t('Copy failed')}: ${(err as Error).message}`)
    } finally {
      setCopying(false)
    }
  }

  const lines = (s: CopySummary) => [
    s.added.length > 0 && (s.added.length === 1 ? t('1 new task') : t('{n} new tasks', { n: s.added.length })),
    s.replaced.length > 0 && (s.replaced.length === 1
      ? t('1 task replaces its version there: {list}', { list: s.replaced[0] })
      : t('{n} tasks replace their version there: {list}', { n: s.replaced.length, list: s.replaced.join(', ') })),
    s.projectsAdded.length > 0 && t('Projects added: {list}', { list: s.projectsAdded.join(', ') }),
    s.resourcesAdded.length > 0 && t('People added: {list}', { list: s.resourcesAdded.join(', ') }),
    s.rolesAdded.length > 0 && t('Roles added: {list}', { list: s.rolesAdded.join(', ') }),
    s.depsAdded > 0 && (s.depsAdded === 1 ? t('1 dependency copied') : t('{n} dependencies copied', { n: s.depsAdded })),
  ].filter((x): x is string => !!x)

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[420px] flex flex-col max-h-[90vh]">
        <div className="px-5 pt-5 pb-4 border-b border-[#ececec]">
          <h2 className="text-sm font-semibold text-[#18181b]">{done ? t('Copied') : selectedIds.length === 1 ? t('Copy 1 task to…') : t('Copy {n} tasks to…', { n: selectedIds.length })}</h2>
          {source && !done && <p className="text-[11px] text-[#a1a1aa] mt-1">{t('From {name}', { name: source.name })}</p>}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
          {done ? (
            <>
              <ul className="m-0 pl-4 text-[12px] text-[#3f3f46] leading-relaxed">{lines(done.summary).map(l => <li key={l}>{l}</li>)}</ul>
              {done.summary.depsDropped.length > 0 && (
                <p className="text-[11px] text-[#9a5b00] m-0">
                  {t('Not copied (that task isn’t in {name}): {list}', { name: scenarios.find(s => s.id === done.targetId)?.name ?? '', list: done.summary.depsDropped.map(d => `${d.from} → ${d.to}`).join(', ') })}
                </p>
              )}
              <p className="text-[11px] text-[#a1a1aa] m-0">{t('A checkpoint of that scenario was saved before copying: restore it from History to undo.')}</p>
            </>
          ) : targets.length === 0 ? (
            <p className="text-[12px] text-[#71717a] m-0">{t('There is no other scenario to copy to. Create one from the scenario menu.')}</p>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                {targets.map(s => (
                  <label key={s.id} className="flex items-center gap-2.5 px-3 py-2 border rounded-lg cursor-pointer text-[13px] text-[#27272a]" style={{ borderColor: s.id === targetId ? '#18181b' : '#ececec' }}>
                    <input type="radio" name="copy-target" checked={s.id === targetId} onChange={() => pick(s.id)} />
                    <span className="truncate">{s.name}</span>
                  </label>
                ))}
              </div>
              {preview.loading && <p className="text-[12px] text-[#a1a1aa] m-0">{t('Checking…')}</p>}
              {preview.error && <p className="text-[12px] text-[#c0584f] m-0">{preview.error}</p>}
              {preview.summary && (
                <div className="p-3 rounded-lg bg-[#fafafa] border border-[#f1f1f1] flex flex-col gap-1.5">
                  <div className="text-[11px] font-semibold text-[#71717a]">{t('In {name}:', { name: targetName })}</div>
                  <ul className="m-0 pl-4 text-[12px] text-[#3f3f46] leading-relaxed">{lines(preview.summary).map(l => <li key={l}>{l}</li>)}</ul>
                  {preview.summary.depsDropped.length > 0 && (
                    <p className="text-[11px] text-[#9a5b00] m-0">
                      {t('Won’t be copied (that task isn’t in {name}): {list}', { name: targetName, list: preview.summary.depsDropped.map(d => `${d.from} → ${d.to}`).join(', ') })}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-[#ececec] flex gap-2">
          {done ? (
            <>
              <button onClick={closeCopy} className={btn}>{t('Close')}</button>
              <button onClick={() => { closeCopy(); switchScenario(done.targetId) }} className={primary}>
                {t('Go to {name}', { name: scenarios.find(s => s.id === done.targetId)?.name ?? '' })}
              </button>
            </>
          ) : (
            <>
              <button onClick={closeCopy} className={btn}>{t('Cancel')}</button>
              <button onClick={copy} disabled={!preview.summary || copying} className={primary}>
                {copying ? t('Copying…') : t('Copy')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
