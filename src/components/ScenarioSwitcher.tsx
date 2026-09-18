'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, GitBranch, Star } from 'lucide-react'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import { switchScenario, promoteScenario } from '@/lib/persistence/scenarioActions'
import { useTranslation } from '@/lib/i18n/useTranslation'

export default function ScenarioSwitcher() {
  const { scenarios, activeScenarioId, officialScenarioId, onNewScenario, showToast } = useRoadmapStore()
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  const active = scenarios.find(s => s.id === activeScenarioId)
  if (!active) return null

  return (
    <div ref={ref} style={{ position: 'relative' }} className="flex-none">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 h-[30px] px-2.5 border border-[#ececec] rounded-lg cursor-pointer text-xs font-semibold text-[#27272a] bg-white font-inherit max-w-[180px]"
      >
        <GitBranch size={13} className="text-[#a1a1aa] flex-none" />
        <span className="truncate">{active.name}</span>
        {active.id === officialScenarioId && (
          <span className="flex-none text-[9px] font-semibold uppercase tracking-[0.04em] text-[#1d4ed8] bg-[#eaf1ff] rounded-full px-1.5 py-0.5">{t('Official')}</span>
        )}
        <ChevronDown size={13} className="text-[#a1a1aa] flex-none" />
      </button>

      {open && (
        <div
          style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 100, width: 260 }}
          className="bg-white border border-[#ececec] rounded-xl shadow-[0_8px_28px_rgba(0,0,0,0.14)] py-1.5"
        >
          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#a1a1aa]">{t('Scenarios')}</div>
          {scenarios.map(s => (
            <div key={s.id} className="flex items-center gap-1 px-1.5">
              <button
                onClick={() => { setOpen(false); if (s.id !== activeScenarioId) switchScenario(s.id) }}
                className="flex-1 min-w-0 text-left px-1.5 py-2 text-[13px] bg-transparent border-none cursor-pointer rounded-md hover:bg-[#f4f4f5] font-inherit truncate"
                style={{ color: s.id === activeScenarioId ? '#18181b' : '#52525b', fontWeight: s.id === activeScenarioId ? 600 : 500 }}
              >
                {s.name}
              </button>
              {s.id === officialScenarioId ? (
                <span className="flex-none text-[9px] font-semibold uppercase tracking-[0.04em] text-[#1d4ed8] bg-[#eaf1ff] rounded-full px-1.5 py-0.5">{t('Official')}</span>
              ) : (
                <button
                  onClick={async () => { await promoteScenario(s.id); showToast(t('"{name}" is now official', { name: s.name })) }}
                  title={t('Make official')}
                  className="flex-none w-6 h-6 border-none bg-transparent cursor-pointer text-[#d4d4d8] hover:text-[#e0902a] flex items-center justify-center p-0"
                >
                  <Star size={13} />
                </button>
              )}
            </div>
          ))}
          <div className="h-px bg-[#f1f1f1] my-1.5 mx-2" />
          <button
            onClick={() => { setOpen(false); onNewScenario() }}
            className="w-full text-left px-3 py-2 text-[13px] text-[#27272a] bg-transparent border-none cursor-pointer rounded-md hover:bg-[#f4f4f5] font-inherit"
          >
            + {t('Duplicate as new scenario')}
          </button>
        </div>
      )}
    </div>
  )
}
