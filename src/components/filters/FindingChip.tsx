'use client'

import { X } from 'lucide-react'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import { useTranslation } from '@/lib/i18n/useTranslation'

// Shown while an Analysis finding is highlighted (filters.finding): names it
// and clears it on ✕. Its items stay at full strength, the rest are dimmed.
export default function FindingChip() {
  const finding = useRoadmapStore(s => s.filters.finding)
  const setFilters = useRoadmapStore(s => s.setFilters)
  const { t } = useTranslation()

  if (!finding) return null
  return (
    <span className="flex items-center gap-1.5 text-[12px] font-medium rounded-lg pl-2.5 pr-1.5 py-1.5 border whitespace-nowrap max-w-[260px]"
      style={{ color: '#3b6ef5', background: '#eaf1ff', borderColor: '#c2d4ff' }}
      title={finding.title}>
      <span className="truncate">{t('Finding: {title}', { title: finding.title })}</span>
      <button
        onClick={() => setFilters({ finding: null })}
        title={t('Clear finding')}
        className="flex-none flex items-center justify-center w-4 h-4 rounded border-none bg-transparent cursor-pointer p-0 text-[#3b6ef5] hover:bg-[#d8e5ff]"
      >
        <X size={12} />
      </button>
    </span>
  )
}
