'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import { useTranslation } from '@/lib/i18n/useTranslation'

// Shown while a dependency path is focused (filters.focusItemId): names the
// item and clears the focus on ✕ or Esc. Esc is left alone while a menu,
// dialog or text field has it.
export default function PathChip() {
  const focusItemId = useRoadmapStore(s => s.filters.focusItemId)
  const item = useRoadmapStore(s => s.items.find(i => i.id === s.filters.focusItemId))
  const setFilters = useRoadmapStore(s => s.setFilters)
  const { t } = useTranslation()

  useEffect(() => {
    if (!focusItemId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const el = e.target as HTMLElement | null
      if (el?.closest('input, select, textarea, [role="dialog"]')) return
      if (useRoadmapStore.getState().contextMenu) return
      setFilters({ focusItemId: null })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusItemId, setFilters])

  if (!item) return null
  return (
    <span className="flex items-center gap-1.5 text-[12px] font-medium rounded-lg pl-2.5 pr-1.5 py-1.5 border whitespace-nowrap max-w-[260px]"
      style={{ color: '#3b6ef5', background: '#eaf1ff', borderColor: '#c2d4ff' }}>
      <span className="truncate">{t('Path: {title}', { title: item.title })}</span>
      <button
        onClick={() => setFilters({ focusItemId: null })}
        title={t('Clear dependency path')}
        className="flex-none flex items-center justify-center w-4 h-4 rounded border-none bg-transparent cursor-pointer p-0 text-[#3b6ef5] hover:bg-[#d8e5ff]"
      >
        <X size={12} />
      </button>
    </span>
  )
}
