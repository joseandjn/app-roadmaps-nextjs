'use client'

import { useMemo } from 'react'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import { assignmentCostsInRange, fmtMoney, initials, resourceDailyRate, AVG_DAYS_PER_MONTH } from '@/lib/roadmapUtils'
import { TOTAL_DAYS } from '@/data/initialData'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useFilterContext } from '@/lib/useFilterContext'
import { itemsForMetrics, resourceMatches } from '@/lib/filters'

function Card({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="border border-[#ececec] rounded-xl px-4 py-3.5 bg-[#fcfcfd]">
      <div className="text-[11px] font-semibold text-[#a1a1aa] mb-1">{label}</div>
      <div className="text-[22px] font-bold tracking-tight text-[#27272a] tabular-nums">{value}</div>
      {note && <div className="text-[11px] text-[#a1a1aa] mt-0.5">{note}</div>}
    </div>
  )
}

export default function CostsView() {
  const { projects, items, resources, filterStartDay, filterEndDay, settings, filters, visible } = useRoadmapStore()
  const { t } = useTranslation()
  const fctx = useFilterContext()
  const fm = (n: number) => fmtMoney(n, settings.currencySymbol)

  const rangeStart = filterStartDay ?? 0
  const rangeEnd = filterEndDay ?? TOTAL_DAYS
  const rangeDays = Math.max(1, rangeEnd - rangeStart)

  const counted = useMemo(() => itemsForMetrics(items, fctx), [items, fctx])
  // Only the matching people's assignments count toward cost.
  const people = useMemo(() => resources.filter(r => resourceMatches(r, filters)), [resources, filters])
  const narrowed = counted.length !== items.length || people.length !== resources.length

  const { byProject, byResource, total } = useMemo(() => {
    const byProject: Record<string, number> = {}
    const byResource: Record<string, number> = {}
    let total = 0
    for (const it of counted) {
      for (const { rid, cost } of assignmentCostsInRange(it, people, rangeStart, rangeEnd, settings)) {
        byProject[it.projectId] = (byProject[it.projectId] ?? 0) + cost
        byResource[rid] = (byResource[rid] ?? 0) + cost
        total += cost
      }
    }
    return { byProject, byResource, total }
  }, [counted, people, rangeStart, rangeEnd, settings])

  const runRate = resources.reduce((s, r) => s + resourceDailyRate(r, settings) * AVG_DAYS_PER_MONTH, 0)
  const dailyBurn = total / rangeDays

  const projectRows = projects
    .filter(p => visible.has(p.id))
    .map(p => ({ p, cost: byProject[p.id] ?? 0, count: items.filter(i => i.projectId === p.id).length }))
    .sort((a, b) => b.cost - a.cost)

  const resourceRows = people
    .map(r => ({ r, cost: byResource[r.id] ?? 0 }))
    .sort((a, b) => b.cost - a.cost)

  const maxProjectCost = Math.max(1, ...projectRows.map(r => r.cost))
  const maxResourceCost = Math.max(1, ...resourceRows.map(r => r.cost))

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
      <div className="grid grid-cols-3 gap-3 mb-6 max-w-[900px]">
        <Card label={t('Allocated cost (range)')} value={fm(total)} />
        <Card label={t('Monthly run-rate')} value={`${fm(runRate)}${t('/mo')}`} note={narrowed ? t('Whole team, not filtered') : undefined} />
        <Card label={t('Avg daily burn')} value={`${fm(dailyBurn)}${t('/day')}`} />
      </div>

      <div className="grid grid-cols-2 gap-6 max-w-[900px]">
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#a1a1aa] mb-3">{t('Cost by project')}</h3>
          <div className="flex flex-col gap-2">
            {projectRows.map(({ p, cost, count }) => (
              <div key={p.id} className="border border-[#f1f1f1] rounded-xl px-3.5 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-[3px] flex-none" style={{ background: p.color }} />
                  <span className="text-[13px] font-semibold text-[#27272a] flex-1 truncate">{p.name}</span>
                  <span className="text-[13px] font-bold text-[#27272a] tabular-nums">{fm(cost)}</span>
                </div>
                <div className="h-1.5 bg-[#f4f4f5] rounded-full">
                  <div className="h-full rounded-full" style={{ width: `${(cost / maxProjectCost) * 100}%`, background: p.color }} />
                </div>
                <div className="text-[11px] text-[#a1a1aa] mt-1.5">{t('{n} items', { n: count })}</div>
              </div>
            ))}
            {projectRows.length === 0 && <p className="text-[13px] text-[#a1a1aa]">{t('No assignments in this period.')}</p>}
          </div>
        </section>

        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#a1a1aa] mb-3">{t('Cost by person')}</h3>
          <div className="flex flex-col gap-2">
            {resourceRows.map(({ r, cost }) => (
              <div key={r.id} className="border border-[#f1f1f1] rounded-xl px-3.5 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-[#ececef] text-[#52525b] text-[10px] font-semibold flex items-center justify-center flex-none">
                    {initials(r.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-[#27272a] truncate">{r.name}</div>
                    <div className="text-[11px] text-[#a1a1aa]">{t(r.role)} · {fm(r.cost)}{r.costUnit === 'hour' ? t('/hr') : t('/mo')}</div>
                  </div>
                  <span className="text-[13px] font-bold text-[#27272a] tabular-nums">{fm(cost)}</span>
                </div>
                <div className="h-1.5 bg-[#f4f4f5] rounded-full">
                  <div className="h-full rounded-full bg-[#3b6ef5]" style={{ width: `${(cost / maxResourceCost) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
