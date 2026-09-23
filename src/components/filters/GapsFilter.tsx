'use client'

import { useRoadmapStore } from '@/store/useRoadmapStore'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useFilterContext } from '@/lib/useFilterContext'
import { itemMatch } from '@/lib/filters'
import FilterChip from './FilterChip'

type Gap = 'unassigned' | 'uncovered'
const GAPS: Gap[] = ['unassigned', 'uncovered']

// Gaps in the plan: work nobody is on, and work whose required roles nobody
// assigned has. Picking both shows items with either gap.
export default function GapsFilter() {
  const items = useRoadmapStore(s => s.items)
  const setFilters = useRoadmapStore(s => s.setFilters)
  const { t } = useTranslation()
  const fctx = useFilterContext()
  const f = fctx.filters

  // How many items each gap alone would show, given the other filters.
  const count = (gap: Gap) => {
    const ctx = { ...fctx, filters: { ...f, unassigned: gap === 'unassigned', uncovered: gap === 'uncovered' } }
    return items.filter(i => itemMatch(i, ctx) !== 'hide').length
  }
  const labels: Record<Gap, string> = { unassigned: t('Unassigned'), uncovered: t('Required role not covered') }

  return (
    <FilterChip
      label={t('Gaps')}
      options={GAPS.map(g => ({ value: g, label: labels[g], hint: t('{n} items', { n: count(g) }) }))}
      selected={GAPS.filter(g => f[g])}
      onToggle={g => setFilters({ [g]: !f[g as Gap] })}
      onSetAll={v => setFilters({ unassigned: v.includes('unassigned'), uncovered: v.includes('uncovered') })}
    />
  )
}
