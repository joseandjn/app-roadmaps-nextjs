'use client'

import { useRoadmapStore } from '@/store/useRoadmapStore'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { initials } from '@/lib/roadmapUtils'
import FilterChip from './FilterChip'

// People chip. Timeline/Cross fade items without any of these people
// assigned; Resources shows only their rows; Costs counts only their cost.
export default function PeopleFilter() {
  const { resources, filters, toggleFilterValue, setFilters } = useRoadmapStore()
  const { t } = useTranslation()

  return (
    <FilterChip
      label={t('People')}
      options={resources.map(r => ({
        value: r.id,
        label: r.name,
        hint: t(r.role),
        icon: (
          <span className="w-5 h-5 rounded-md bg-[#ececef] text-[#52525b] text-[9px] font-semibold flex items-center justify-center flex-none">
            {initials(r.name)}
          </span>
        ),
      }))}
      selected={filters.resourceIds}
      onToggle={v => toggleFilterValue('resourceIds', v)}
      onSetAll={v => setFilters({ resourceIds: v })}
    />
  )
}
