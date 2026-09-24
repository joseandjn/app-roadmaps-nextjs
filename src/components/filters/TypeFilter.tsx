'use client'

import { useRoadmapStore } from '@/store/useRoadmapStore'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { ITEM_TYPES } from '@/data/initialData'
import type { ItemType } from '@/types'
import FilterChip, { FilterShortcut } from './FilterChip'

// Epics, milestones and releases only: the high-level shape of the plan.
const EXECUTIVE: ItemType[] = ['epic', 'milestone', 'release']

// Item type chip. Hides items of the types not picked. Milestones and
// releases carry no load or cost, so filtering them never changes metrics.
export default function TypeFilter() {
  const { filters, toggleFilterValue, setFilters } = useRoadmapStore()
  const { t } = useTranslation()
  const selected = filters.types
  const executive = selected.length === EXECUTIVE.length && EXECUTIVE.every(ty => selected.includes(ty))

  return (
    <FilterChip
      label={t('Type')}
      options={ITEM_TYPES.map(ty => ({ value: ty, label: t(ty.charAt(0).toUpperCase() + ty.slice(1)) }))}
      selected={selected}
      onToggle={v => toggleFilterValue('types', v)}
      onSetAll={v => setFilters({ types: v as ItemType[] })}
      header={
        <div className="px-1.5 py-1">
          <FilterShortcut active={executive} onClick={() => setFilters({ types: executive ? [] : EXECUTIVE })}>
            {t('Executive view')}
          </FilterShortcut>
        </div>
      }
    />
  )
}
