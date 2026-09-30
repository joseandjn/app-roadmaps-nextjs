'use client'

import { useMemo } from 'react'
import { Plus } from 'lucide-react'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import { roleIconDef } from '@/data/roleIcons'
import { initials, fmtMoney, resourceCapacity } from '@/lib/roadmapUtils'
import { useTranslation } from '@/lib/i18n/useTranslation'

// The team at a glance: role, rate, availability and how many tasks each
// person has. Adding or editing opens the same form as the Team tab.
export default function PeopleSettings() {
  const { resources, items, roles, settings, onNewResource, editResource } = useRoadmapStore()
  const { t } = useTranslation()
  const taskCount = useMemo(() => {
    const n = new Map<string, number>()
    for (const it of items) for (const a of it.assignments) n.set(a.r, (n.get(a.r) ?? 0) + 1)
    return n
  }, [items])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-[#71717a]">{t('{n} people', { n: resources.length })}</span>
        <button onClick={onNewResource} className="flex items-center gap-1 text-[11px] font-semibold text-[#52525b] border border-[#ececec] rounded-md px-2 py-1 bg-white cursor-pointer font-inherit">
          <Plus size={12} /> {t('Add person')}
        </button>
      </div>

      {resources.length === 0 ? (
        <p className="text-[12px] text-[#a1a1aa] m-0">{t('No people yet. Add the people who work on the roadmap to assign them to tasks.')}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {resources.map(r => {
            const { Icon } = roleIconDef(roles.find(x => x.name === r.role)?.icon)
            const cap = resourceCapacity(r)
            const tasks = taskCount.get(r.id) ?? 0
            return (
              <button
                key={r.id}
                onClick={() => editResource(r.id)}
                title={t('Edit')}
                className="w-full flex items-center gap-3 px-2.5 py-2 bg-white border border-[#f1f1f1] rounded-lg text-left cursor-pointer font-inherit hover:border-[#e4e4e7]"
              >
                <div className="w-[28px] h-[28px] rounded-[8px] bg-[#ececef] text-[#52525b] text-[10px] font-semibold flex items-center justify-center flex-none">{initials(r.name)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-[#27272a] truncate">{r.name}</div>
                  <div className="flex items-center gap-1 text-[11px] text-[#a1a1aa] truncate">
                    <Icon size={10} className="flex-none" />
                    {t(r.role)} · {t(tasks === 1 ? '1 task' : '{n} tasks', { n: tasks })}
                  </div>
                </div>
                <div className="text-right flex-none">
                  <div className="text-[12px] font-semibold text-[#27272a] tabular-nums">{fmtMoney(r.cost, settings.currencySymbol)}{r.costUnit === 'hour' ? t('/hr') : t('/mo')}</div>
                  <div className={`text-[11px] tabular-nums ${cap < 100 ? 'text-[#9a5b00]' : 'text-[#a1a1aa]'}`}>{t('avail. {n}%', { n: cap })}</div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
