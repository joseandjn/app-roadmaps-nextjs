'use client'

import { useEffect } from 'react'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import { useTranslation } from '@/lib/i18n/useTranslation'

// Floating bar while Timeline items are selected (Cmd/Ctrl/Shift-click):
// how many, "Copy to…" and clear. Esc clears too.
export default function SelectionBar() {
  const { selectedIds, copyOpen, openCopy, clearSelected } = useRoadmapStore()
  const { t } = useTranslation()
  const n = selectedIds.length

  useEffect(() => {
    if (!n || copyOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') clearSelected() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [n, copyOpen, clearSelected])

  if (!n) return null
  return (
    <div
      className="absolute bottom-[60px] left-1/2 -translate-x-1/2 z-[44] flex items-center gap-1 bg-[#18181b] text-white rounded-xl pl-4 pr-1.5 py-1.5 text-xs"
      style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.18)', animation: 'popIn .18s ease' }}
    >
      <span className="font-semibold mr-2 whitespace-nowrap">{n === 1 ? t('1 task selected') : t('{n} selected', { n })}</span>
      <button onClick={openCopy} className="bg-white text-[#18181b] border-none rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer font-inherit whitespace-nowrap">
        {t('Copy to…')}
      </button>
      <button onClick={clearSelected} className="bg-transparent text-[#d4d4d8] border-none rounded-lg px-2.5 py-1.5 text-xs font-semibold cursor-pointer font-inherit hover:text-white whitespace-nowrap">
        {t('Clear')}
      </button>
    </div>
  )
}
