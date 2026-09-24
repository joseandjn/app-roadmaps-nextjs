'use client'

import { useMemo } from 'react'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { uncoveredDemand } from '@/lib/filters'
import type { Item } from '@/types'

// Resources, with the "Required role not covered" gap filter on: how much
// work each role combination is missing someone for. Clicking a group sets
// the Roles filter to it, so the grid shows who could take that work.
export default function UncoveredDemand({ items, fromDay, toDay }: { items: Item[]; fromDay: number; toDay: number }) {
  const resources = useRoadmapStore(s => s.resources)
  const settings = useRoadmapStore(s => s.settings)
  const roleFilter = useRoadmapStore(s => s.filters.roles)
  const setFilters = useRoadmapStore(s => s.setFilters)
  const { t } = useTranslation()
  const groups = useMemo(() => uncoveredDemand(items, resources, settings, fromDay, toDay), [items, resources, settings, fromDay, toDay])

  const isActive = (roles: string[]) => roles.length === roleFilter.length && roles.every(r => roleFilter.includes(r))

  return (
    <div className="flex-none flex items-center gap-2 px-4 py-2 border-b border-[#ececec] bg-white overflow-x-auto">
      <span className="text-[11px] font-semibold text-[#71717a] uppercase tracking-[0.05em] whitespace-nowrap">{t('Uncovered demand by role')}</span>
      {groups.length === 0 && <span className="text-[12px] text-[#a1a1aa]">{t('Every required role is covered in this period.')}</span>}
      {groups.map(g => {
        const on = isActive(g.roles)
        return (
          <button
            key={g.roles.join('|')}
            onClick={() => setFilters({ roles: on ? [] : g.roles })}
            title={on ? t('Show everyone again') : t('Show the people with this role')}
            className="flex items-center gap-1.5 text-[12px] rounded-lg px-2.5 py-1 border cursor-pointer font-inherit whitespace-nowrap"
            style={on
              ? { color: '#3b6ef5', background: '#eaf1ff', borderColor: '#c2d4ff' }
              : { color: '#52525b', background: '#fff', borderColor: '#ececec' }}
          >
            <span className="font-semibold">{g.roles.map(r => t(r)).join(' / ')}</span>
            <span className="text-[#71717a]">{t('{n} items · {d} working days', { n: g.items, d: g.workDays })}</span>
          </button>
        )
      })}
    </div>
  )
}
