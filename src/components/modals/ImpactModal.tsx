'use client'

import { useRoadmapStore } from '@/store/useRoadmapStore'
import { initials, allocColor } from '@/lib/roadmapUtils'
import { useTranslation } from '@/lib/i18n/useTranslation'

export default function ImpactModal() {
  const { impact, resources, projects, commitItem } = useRoadmapStore()
  const set = useRoadmapStore.setState
  const { t } = useTranslation()

  if (!impact?.show) return null

  const { imp, orig } = impact
  const clean = imp.resources.length === 0 && imp.deps.length === 0 && imp.projects.length <= 1

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[440px] flex flex-col max-h-[90vh]">
        <div className="px-5 pt-5 pb-4 border-b border-[#ececec]">
          <h2 className="text-sm font-semibold text-[#18181b]">{orig ? t('Preview impact') : t('Confirm new item')}</h2>
          <p className="text-[12px] text-[#71717a] mt-0.5">{orig ? t('Review the cascading effects before applying this change.') : t('Review effects before creating this item.')}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {clean && (
            <div className="flex items-center gap-2 text-[13px] text-[#1f7a3d] bg-[#ecf6ef] border border-[#cde7d4] rounded-xl px-3.5 py-2.5">
              <span>✓</span> {t('No conflicts detected.')}
            </div>
          )}

          {imp.resources.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#a1a1aa] mb-2.5">{t('Resource impact')}</div>
              <div className="flex flex-col gap-2">
                {imp.resources.map(rr => {
                  const r = resources.find(res => res.id === rr.rid)!
                  const col = allocColor(rr.after)
                  return (
                    <div key={rr.rid} className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-[7px] bg-[#ececef] text-[#52525b] text-[10px] font-semibold flex items-center justify-center flex-none">{initials(r.name)}</div>
                      <span className="text-[13px] text-[#27272a] flex-1">{r.name}</span>
                      <span className="text-[12px] text-[#a1a1aa] tabular-nums">{rr.before}%</span>
                      <span className="text-[12px] text-[#a1a1aa]">→</span>
                      <span className="text-[13px] font-bold tabular-nums" style={{ color: rr.over ? '#9a5b00' : '#27272a' }}>{rr.after}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {imp.deps.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#a1a1aa] mb-2.5">{t('Dependency impact')}</div>
              <div className="flex flex-col gap-1.5">
                {imp.deps.map((d, i) => {
                  const pr = projects.find(p => p.id === d.item.projectId)
                  return (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 border border-[#f1f1f1] rounded-lg">
                      <span className="w-2 h-2 rounded-[2px] flex-none" style={{ background: pr?.color ?? '#a1a1aa' }} />
                      <span className="text-[12px] text-[#27272a] flex-1 truncate">{d.item.title} · {pr?.name.split(' — ')[0]}</span>
                      {d.clash && <span className="text-[10px] font-semibold text-[#9a5b00] bg-[#fdf1e3] border border-[#f1d3a8] rounded px-1.5 py-0.5">{t('Clash')}</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {imp.projects.length > 1 && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#a1a1aa] mb-2.5">{t('Projects affected')}</div>
              <div className="flex flex-wrap gap-2">
                {imp.projects.map(pid => {
                  const p = projects.find(pr => pr.id === pid)!
                  return (
                    <div key={pid} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#3f3f46] bg-[#f4f4f5] border border-[#ececec] px-2.5 py-1 rounded-lg">
                      <span className="w-2 h-2 rounded-[2px] flex-none" style={{ background: p?.color }} />
                      {p?.name.split(' — ')[0]}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-[#ececec] flex gap-2">
          <button onClick={() => set({ impact: null })} className="flex-1 border border-[#ececec] text-[#52525b] bg-white rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer font-inherit">
            {t('Cancel')}
          </button>
          <button onClick={commitItem} className="flex-1 bg-[#18181b] text-white border-none rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer font-inherit">
            {orig ? t('Apply changes') : t('Create item')}
          </button>
        </div>
      </div>
    </div>
  )
}
