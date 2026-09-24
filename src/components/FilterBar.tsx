'use client'

import { useSyncExternalStore } from 'react'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import { dateStr, offFromStr } from '@/lib/roadmapUtils'
import { TOTAL_DAYS } from '@/data/initialData'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { activeFilterCount } from '@/lib/filters'
import ProjectsFilter from '@/components/filters/ProjectsFilter'
import StatusFilter from '@/components/filters/StatusFilter'
import PeopleFilter from '@/components/filters/PeopleFilter'
import RolesFilter from '@/components/filters/RolesFilter'
import TypeFilter from '@/components/filters/TypeFilter'
import IssuesToggle from '@/components/filters/IssuesToggle'
import GapsFilter from '@/components/filters/GapsFilter'
import PathChip from '@/components/filters/PathChip'
import ViewsMenu from '@/components/filters/ViewsMenu'
import SearchBox from '@/components/filters/SearchBox'
import FiltersGroup from '@/components/filters/FiltersGroup'

// Below this width the chips don't fit next to the dates and search (plus
// Reset, the badge and a path chip), so they collapse into FiltersGroup.
const WIDE_QUERY = '(min-width: 1600px)'
const subscribeWide = (cb: () => void) => {
  const mq = window.matchMedia(WIDE_QUERY)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

export default function FilterBar() {
  const { filterStartDay, filterEndDay, filters, visible, projects, setFilter, clearFilter } = useRoadmapStore()
  const { t } = useTranslation()
  const activeCount = activeFilterCount({ filters, visible, projects, filterStartDay, filterEndDay })
  const isActive = activeCount > 0
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE_QUERY).matches, () => true)
  // What the grouped chips cover: everything but dates, search and the path.
  const chipCount = activeCount
    - (filterStartDay !== null || filterEndDay !== null ? 1 : 0)
    - (filters.text.trim() ? 1 : 0)
    - (filters.focusItemId ? 1 : 0)

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

  const chips = (
    <>
      <ProjectsFilter />
      <StatusFilter />
      <TypeFilter />
      <PeopleFilter />
      <RolesFilter />
      <GapsFilter />
      <IssuesToggle />
    </>
  )

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-[#ececec] bg-[#fafafa]">
      <ViewsMenu />
      <span className="hidden min-[1440px]:inline text-[11px] font-semibold text-[#71717a] uppercase tracking-[0.05em] whitespace-nowrap">{t('Date range')}</span>

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
        <SearchBox />
        {wide ? chips : <FiltersGroup count={chipCount}>{chips}</FiltersGroup>}
        <PathChip />
      </div>

      {isActive && (
        <button
          onClick={clearFilter}
          className="text-[11px] font-semibold text-[#52525b] border border-[#ececec] rounded-lg px-2.5 py-1.5 bg-white cursor-pointer font-inherit hover:bg-[#f4f4f5]"
        >
          {t('Reset')}
        </button>
      )}

      {isActive && wide && (
        <span className="ml-1 text-[11px] font-medium text-[#3b6ef5] bg-[#eaf1ff] border border-[#c2d4ff] rounded-full px-2 py-0.5">
          {t('filtered')}{activeCount > 1 && ` · ${activeCount}`}
        </span>
      )}
    </div>
  )
}
