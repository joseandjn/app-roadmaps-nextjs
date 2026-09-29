'use client'

import { useEffect } from 'react'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import { useTranslation } from '@/lib/i18n/useTranslation'

// Keys for the Timeline selection, and a floating bar once two or more
// items are selected: how many, "Copy to…" and clear. (A single item is
// selected on every click; a bar for it would pop up all the time. One item
// can be copied from its right-click menu.) Esc clears; Enter opens the one
// selected item in the editor.
export default function SelectionBar() {
  const { selectedIds, copyOpen, panel, draft, openCopy, clearSelected, openItem } = useRoadmapStore()
  const { t } = useTranslation()
  const n = selectedIds.length

  useEffect(() => {
    if (!n || copyOpen) return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el?.closest('input, textarea, select, button, a, [contenteditable="true"], [role="dialog"]')) return
      if (e.key === 'Escape') clearSelected()
      else if (e.key === 'Enter' && n === 1 && !(panel === 'item' && draft?.id === selectedIds[0])) { e.preventDefault(); openItem(selectedIds[0]) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [n, copyOpen, panel, draft?.id, selectedIds, clearSelected, openItem])

  if (n < 2) return null
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
