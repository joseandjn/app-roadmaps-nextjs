'use client'

import { AlertTriangle } from 'lucide-react'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useFilterContext } from '@/lib/useFilterContext'
import { itemMatch } from '@/lib/filters'

// "Only issues" toggle. The count is how many items it would show given the
// other filters, so it matches what you get when you turn it on.
export default function IssuesToggle() {
  const items = useRoadmapStore(s => s.items)
  const setFilters = useRoadmapStore(s => s.setFilters)
  const { t } = useTranslation()
  const fctx = useFilterContext()
  const on = fctx.filters.onlyIssues
  const withIssues = { ...fctx, filters: { ...fctx.filters, onlyIssues: true } }
  const count = items.filter(i => itemMatch(i, withIssues) !== 'hide').length

  return (
    <button
      onClick={() => setFilters({ onlyIssues: !on })}
      title={t('Only items with a dependency clash, an overloaded assignee, an assignee with the wrong role or on time off, or At Risk status')}
      className="flex items-center gap-1.5 text-[12px] font-medium rounded-lg px-2.5 py-1.5 border cursor-pointer font-inherit whitespace-nowrap"
      style={on
        ? { color: '#3b6ef5', background: '#eaf1ff', borderColor: '#c2d4ff' }
        : { color: '#52525b', background: '#fff', borderColor: '#ececec' }}
    >
      <AlertTriangle size={12} style={{ color: count > 0 ? '#c2410c' : undefined }} />
      {t('Only issues')}
      <span className="tabular-nums font-semibold">{count}</span>
    </button>
  )
}
