'use client'

import { useRoadmapStore } from '@/store/useRoadmapStore'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { STATUS_CONFIG, STATUS_ORDER } from '@/data/initialData'
import type { StatusKey } from '@/types'
import FilterChip from './FilterChip'

const NOT_DONE: StatusKey[] = STATUS_ORDER.filter(s => s !== 'Done')

// Item status chip. Hides items whose status isn't picked; "Hide Done" is the
// common case, so it gets a one-click shortcut.
export default function StatusFilter() {
  const { filters, toggleFilterValue, setFilters } = useRoadmapStore()
  const { t } = useTranslation()
  const selected = filters.statuses
  const hidingDone = selected.length === NOT_DONE.length && NOT_DONE.every(s => selected.includes(s))

  return (
    <FilterChip
      label={t('Status')}
      options={STATUS_ORDER.map(s => ({ value: s, label: t(s), color: STATUS_CONFIG[s].dot }))}
      selected={selected}
      onToggle={v => toggleFilterValue('statuses', v)}
      onSetAll={v => setFilters({ statuses: v as StatusKey[] })}
      header={
        <div className="px-1.5 py-1">
          <button
            onClick={() => setFilters({ statuses: hidingDone ? [] : NOT_DONE })}
            className="text-[11px] font-medium rounded-md px-2 py-0.5 border cursor-pointer font-inherit"
            style={hidingDone
              ? { color: '#3b6ef5', background: '#eaf1ff', borderColor: '#c2d4ff' }
              : { color: '#52525b', background: '#fff', borderColor: '#ececec' }}
          >
            {t('Hide Done')}
          </button>
        </div>
      }
    />
  )
}
