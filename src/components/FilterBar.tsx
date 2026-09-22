'use client'

import { useRoadmapStore } from '@/store/useRoadmapStore'
import { dateStr, offFromStr } from '@/lib/roadmapUtils'
import { TOTAL_DAYS } from '@/data/initialData'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { activeFilterCount } from '@/lib/filters'
import ProjectsFilter from '@/components/filters/ProjectsFilter'
import StatusFilter from '@/components/filters/StatusFilter'

export default function FilterBar() {
  const { filterStartDay, filterEndDay, filters, visible, projects, setFilter, clearFilter } = useRoadmapStore()
  const { t } = useTranslation()
  const activeCount = activeFilterCount({ filters, visible, projects, filterStartDay, filterEndDay })
  const isActive = activeCount > 0

  const startVal = dateStr(filterStartDay ?? 0)
  const endVal   = dateStr(filterEndDay   ?? TOTAL_DAYS)

  const handleStart = (v: string) => {
    if (!v) return
    const day = offFromStr(v)
    const end = filterEndDay ?? TOTAL_DAYS
    setFilter(Math.min(day, end - 1), end)
  }

  const handleEnd = (v: string) => {
    if (!v) return
    const day = offFromStr(v)
    const start = filterStartDay ?? 0
    setFilter(start, Math.max(day, start + 1))
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-[#ececec] bg-[#fafafa]">
      <span className="text-[11px] font-semibold text-[#71717a] uppercase tracking-[0.05em] whitespace-nowrap">{t('Date range')}</span>

      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={startVal}
          onChange={e => handleStart(e.target.value)}
          className="text-[12px] text-[#27272a] border border-[#ececec] rounded-lg px-2.5 py-1.5 bg-white font-inherit cursor-pointer"
        />
        <span className="text-[12px] text-[#a1a1aa]">→</span>
        <input
          type="date"
          value={endVal}
          onChange={e => handleEnd(e.target.value)}
          className="text-[12px] text-[#27272a] border border-[#ececec] rounded-lg px-2.5 py-1.5 bg-white font-inherit cursor-pointer"
        />
      </div>

      <div className="flex items-center gap-1.5 ml-2">
        <ProjectsFilter />
        <StatusFilter />
      </div>

      {isActive && (
        <button
          onClick={clearFilter}
          className="text-[11px] font-semibold text-[#52525b] border border-[#ececec] rounded-lg px-2.5 py-1.5 bg-white cursor-pointer font-inherit hover:bg-[#f4f4f5]"
        >
          {t('Reset')}
        </button>
      )}

      {isActive && (
        <span className="ml-1 text-[11px] font-medium text-[#3b6ef5] bg-[#eaf1ff] border border-[#c2d4ff] rounded-full px-2 py-0.5">
          {t('filtered')}{activeCount > 1 && ` · ${activeCount}`}
        </span>
      )}
    </div>
  )
}
