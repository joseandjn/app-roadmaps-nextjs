'use client'

import { useEffect, useState } from 'react'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import { computeScenarioMetrics, fmtMoney, fmtDate, addDays } from '@/lib/roadmapUtils'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { switchScenario, promoteScenario } from '@/lib/persistence/scenarioActions'
import type { ScenarioData, ScenarioMeta } from '@/types'

interface Row {
  meta: ScenarioMeta
  data: ScenarioData | null
  totalCost: number
  endDay: number | null
  overallocated: number
  headcount: number
  itemCount: number
}

async function loadRow(meta: ScenarioMeta): Promise<Row> {
  const res = await fetch(`/api/scenarios/${meta.id}`)
  const data: ScenarioData | null = res.ok ? await res.json() : null
  if (!data) return { meta, data, totalCost: 0, endDay: null, overallocated: 0, headcount: 0, itemCount: 0 }
  return { meta, data, ...computeScenarioMetrics(data) }
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[#a1a1aa] px-4 py-2.5 whitespace-nowrap">{children}</th>
}

export default function CompareView() {
  const { scenarios, officialScenarioId, activeScenarioId, showToast } = useRoadmapStore()
  const { t } = useTranslation()
  const [rows, setRows] = useState<Row[] | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all(scenarios.map(loadRow)).then(results => { if (!cancelled) setRows(results) })
    return () => { cancelled = true }
  }, [scenarios])

  if (!rows) {
    return <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 text-[13px] text-[#a1a1aa]">{t('Loading…')}</div>
  }

  const costs = rows.filter(r => r.itemCount > 0).map(r => r.totalCost)
  const minCost = costs.length ? Math.min(...costs) : null
  const ends = rows.filter(r => r.endDay !== null).map(r => r.endDay!)
  const minEnd = ends.length ? Math.min(...ends) : null

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
      <p className="text-[13px] text-[#71717a] mb-4 max-w-[560px]">
        {t('Metrics are computed over each scenario\'s full timeline, regardless of the date filter.')}
      </p>

      <div className="border border-[#ececec] rounded-xl overflow-hidden max-w-[900px]">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#fcfcfd] border-b border-[#ececec]">
              <Th>{t('Scenario')}</Th>
              <Th>{t('Total cost')}</Th>
              <Th>{t('End date')}</Th>
              <Th>{t('Overallocated')}</Th>
              <Th>{t('People')}</Th>
              <Th>{t('Items')}</Th>
              <Th>{''}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ meta, data, totalCost, endDay, overallocated, headcount, itemCount }) => {
              const fm = (n: number) => fmtMoney(n, data?.settings.currencySymbol ?? '$')
              const isBestCost = minCost !== null && itemCount > 0 && totalCost === minCost
              const isBestEnd = minEnd !== null && endDay === minEnd
              return (
                <tr key={meta.id} className="border-b border-[#f4f4f5] last:border-b-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-[#27272a]">{meta.name}</span>
                      {meta.id === officialScenarioId && (
                        <span className="text-[9px] font-semibold uppercase tracking-[0.04em] text-[#1d4ed8] bg-[#eaf1ff] rounded-full px-1.5 py-0.5">{t('Official')}</span>
                      )}
                    </div>
                    {meta.note && <div className="text-[11px] text-[#a1a1aa] mt-0.5">{meta.note}</div>}
                  </td>
                  <td className="px-4 py-3 text-[13px] tabular-nums" style={{ color: isBestCost ? '#1f7a3d' : '#27272a', fontWeight: isBestCost ? 600 : 400 }}>
                    {itemCount > 0 ? fm(totalCost) : '—'}
                  </td>
                  <td className="px-4 py-3 text-[13px] tabular-nums" style={{ color: isBestEnd ? '#1f7a3d' : '#27272a', fontWeight: isBestEnd ? 600 : 400 }}>
                    {endDay !== null ? fmtDate(addDays(endDay)) : '—'}
                  </td>
                  <td className="px-4 py-3 text-[13px] tabular-nums" style={{ color: overallocated > 0 ? '#9a5b00' : '#27272a' }}>
                    {overallocated > 0 ? overallocated : '—'}
                  </td>
                  <td className="px-4 py-3 text-[13px] tabular-nums text-[#52525b]">{headcount}</td>
                  <td className="px-4 py-3 text-[13px] tabular-nums text-[#52525b]">{itemCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      {meta.id !== activeScenarioId && (
                        <button
                          onClick={() => switchScenario(meta.id)}
                          className="text-[11px] font-semibold text-[#52525b] border border-[#ececec] rounded-md px-2 py-1 bg-white cursor-pointer hover:bg-[#f4f4f5]"
                        >
                          {t('Switch to this')}
                        </button>
                      )}
                      {meta.id !== officialScenarioId && (
                        <button
                          onClick={async () => { await promoteScenario(meta.id); showToast(t('"{name}" is now official', { name: meta.name })) }}
                          className="text-[11px] font-semibold text-[#1d4ed8] border border-[#c2d4ff] bg-[#eaf1ff] rounded-md px-2 py-1 cursor-pointer hover:bg-[#dbe7fd]"
                        >
                          {t('Make official')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
