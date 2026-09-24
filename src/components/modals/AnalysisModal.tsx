'use client'

import { useEffect, useState } from 'react'
import { Loader2, Crosshair } from 'lucide-react'
import type { AnalyzeResponse, Severity } from '@engine/index'
import { requestAnalysis } from '@/lib/analysis/requestAnalysis'
import { findingItemIds } from '@/lib/analysis/findingItems'
import { scrollToItem } from '@/lib/scrollToItem'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import { useTranslation } from '@/lib/i18n/useTranslation'

const SEVERITY: Record<Severity, { bg: string; fg: string; label: string }> = {
  high: { bg: '#fdecec', fg: '#b42318', label: 'High' },
  medium: { bg: '#fdf3dd', fg: '#9a5b00', label: 'Medium' },
  low: { bg: '#eef3fc', fg: '#2f5db0', label: 'Low' },
}

type Narration = { state: 'idle' | 'loading' | 'done' } | { state: 'error'; error: string }

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-[12px] text-[#71717a]">
      <Loader2 size={13} className="animate-spin" />
      {label}
    </div>
  )
}

function AnalysisPanel() {
  const toggleAnalysis = useRoadmapStore(s => s.toggleAnalysis)
  const setFilters = useRoadmapStore(s => s.setFilters)
  const clearFilter = useRoadmapStore(s => s.clearFilter)
  const setView = useRoadmapStore(s => s.setView)
  const items = useRoadmapStore(s => s.items)
  const { t } = useTranslation()
  const [run, setRun] = useState(0)
  const [report, setReport] = useState<AnalyzeResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [narration, setNarration] = useState<Narration>({ state: 'idle' })

  useEffect(() => {
    const controller = new AbortController()
    ;(async () => {
      let base: AnalyzeResponse
      try {
        base = await requestAnalysis(false, controller.signal)
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : String(err))
        return
      }
      setReport(base)
      if (base.findings.length === 0) return

      setNarration({ state: 'loading' })
      try {
        const full = await requestAnalysis(true, controller.signal)
        setReport(full)
        setNarration(full.narrative ? { state: 'done' } : { state: 'error', error: full.narrativeError ?? '' })
      } catch (err) {
        if (!controller.signal.aborted) setNarration({ state: 'error', error: err instanceof Error ? err.message : String(err) })
      }
    })()
    return () => controller.abort()
  }, [run])

  const analyzeAgain = () => {
    setReport(null)
    setError(null)
    setNarration({ state: 'idle' })
    setRun(n => n + 1)
  }

  // Highlights the finding's items on the Timeline (the rest are dimmed) and
  // scrolls to the earliest one once the view has drawn it. The analysis
  // covers the whole plan, so other filters are cleared first — otherwise
  // they could hide the very items the finding is about.
  const showInTimeline = (title: string, ids: string[]) => {
    clearFilter()
    setFilters({ finding: { title, itemIds: ids } })
    setView('timeline')
    toggleAnalysis()
    const first = items.filter(i => ids.includes(i.id)).sort((a, b) => a.startDay - b.startDay)[0]
    if (first) requestAnimationFrame(() => requestAnimationFrame(() => scrollToItem(first.id)))
  }

  const titleOf = (id: string) => report?.findings.find(f => f.id === id)?.title ?? id
  const loading = !report && !error

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[560px] max-h-[85vh] flex flex-col">
        <div className="px-5 pt-5 pb-4 border-b border-[#ececec] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#18181b]">{t('Roadmap analysis')}</h2>
            <p className="text-[11px] text-[#a1a1aa] mt-0.5">{t('Suggestions only — nothing in your roadmap is changed.')}</p>
          </div>
          <button onClick={toggleAnalysis} className="text-[#a1a1aa] text-lg leading-none cursor-pointer border-none bg-transparent p-0">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {loading && <Spinner label={t('Analyzing…')} />}
          {error && (
            <p className="text-[12px] text-[#b42318] bg-[#fdecec] rounded-lg px-3 py-2">{t("Couldn't analyze the roadmap: {error}", { error })}</p>
          )}

          {report && report.findings.length === 0 && (
            <p className="text-[13px] text-[#71717a]">{t('No findings — no overloaded people, dependency conflicts or cycles were detected.')}</p>
          )}

          {report && report.findings.length > 0 && (
            <>
              <div className="flex gap-2">
                {(['high', 'medium', 'low'] as const).map(sev => (
                  <span
                    key={sev}
                    className="text-[11px] font-semibold rounded-md px-2 py-1"
                    style={{ background: SEVERITY[sev].bg, color: SEVERITY[sev].fg }}
                  >
                    {report.summary.bySeverity[sev]} {t(SEVERITY[sev].label)}
                  </span>
                ))}
              </div>

              {narration.state !== 'idle' && (
                <section className="rounded-xl border border-[#ececec] bg-[#fafafa] px-4 py-3 flex flex-col gap-2.5">
                  <h3 className="text-[11px] font-semibold text-[#71717a] uppercase tracking-wide">{t('AI summary')}</h3>
                  {narration.state === 'loading' && <Spinner label={t('Generating AI summary…')} />}
                  {narration.state === 'error' && (
                    <p className="text-[12px] text-[#71717a]">
                      {t("Couldn't generate the AI summary: {error}", { error: narration.error })} {t('The findings below were computed anyway.')}
                    </p>
                  )}
                  {narration.state === 'done' && report.narrative && (
                    <>
                      <p className="text-[13px] text-[#27272a] leading-relaxed">{report.narrative.summary}</p>
                      {report.narrative.priorities.length > 0 && (
                        <div className="flex flex-col gap-2.5">
                          <h4 className="text-[11px] font-semibold text-[#71717a]">{t('Priorities')}</h4>
                          {report.narrative.priorities.map((p, i) => (
                            <div key={`${p.findingId}-${i}`} className="text-[12px] text-[#3f3f46] leading-relaxed">
                              <div className="font-semibold text-[#18181b]">{i + 1}. {titleOf(p.findingId)}</div>
                              <div><span className="text-[#71717a]">{t('Why')}: </span>{p.why}</div>
                              <div><span className="text-[#71717a]">{t('Suggested action')}: </span>{p.action}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </section>
              )}

              <section className="flex flex-col gap-2">
                <h3 className="text-[11px] font-semibold text-[#71717a] uppercase tracking-wide">{t('All findings')}</h3>
                {report.findings.map(f => {
                  // Only items that still exist: the report can predate an edit.
                  const ids = findingItemIds(f).filter(id => items.some(i => i.id === id))
                  return (
                  <div key={f.id} className="rounded-xl border border-[#ececec] px-3.5 py-3">
                    <div className="flex items-start gap-2">
                      <span
                        className="flex-none text-[10px] font-semibold rounded px-1.5 py-0.5 mt-px"
                        style={{ background: SEVERITY[f.severity].bg, color: SEVERITY[f.severity].fg }}
                      >
                        {t(SEVERITY[f.severity].label)}
                      </span>
                      <div className="text-[13px] font-semibold text-[#18181b] leading-snug">{f.title}</div>
                    </div>
                    <p className="text-[12px] text-[#52525b] leading-relaxed mt-1.5">{f.detail}</p>
                    {ids.length > 0 && (
                      <button
                        onClick={() => showInTimeline(f.title, ids)}
                        title={t('Clears the current filters and highlights these items')}
                        className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#3b6ef5] bg-transparent border-none cursor-pointer font-inherit p-0 hover:underline"
                      >
                        <Crosshair size={12} />
                        {t('Show in Timeline')}
                        <span className="text-[#a1a1aa] font-medium">· {t('{n} items', { n: ids.length })}</span>
                      </button>
                    )}
                  </div>
                  )
                })}
              </section>
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-[#ececec] flex justify-end">
          <button
            onClick={analyzeAgain}
            disabled={loading || narration.state === 'loading'}
            className="border border-[#ececec] text-[#52525b] bg-white rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer font-inherit disabled:opacity-50 disabled:cursor-default"
          >
            {t('Analyze again')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AnalysisModal() {
  const analysisOpen = useRoadmapStore(s => s.analysisOpen)
  return analysisOpen ? <AnalysisPanel /> : null
}
