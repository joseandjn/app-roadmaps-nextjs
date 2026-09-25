'use client'

import { useRoadmapStore } from '@/store/useRoadmapStore'
import { roleIconDef } from '@/data/roleIcons'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { dateStr, offFromStr, workingDaysInRange } from '@/lib/roadmapUtils'
import { getTodayDay } from '@/data/initialData'
import type { TimeOff } from '@/types'

const labelCls = 'text-[11px] font-semibold text-[#71717a] mb-1.5'
const inputCls = 'w-full text-[13px] text-[#27272a] bg-white border border-[#ececec] rounded-lg px-2.5 py-2 font-inherit'

export default function ResourceModal() {
  const { rform, settings, roles, patchRF, onRSave, onRCancel, onRDelete } = useRoadmapStore()
  const { t } = useTranslation()

  if (!rform?.show) return null

  // Dates in the form are inclusive ("from the 1st to the 15th"); stored as
  // startDay + dur like items. An end before the start is pulled up to it.
  const lastDay = (o: TimeOff) => o.startDay + o.dur - 1
  const setOff = (id: string, patch: Partial<TimeOff>) =>
    patchRF({ timeOff: rform.timeOff.map(o => (o.id === id ? { ...o, ...patch } : o)) })
  const setFrom = (o: TimeOff, v: string) => {
    if (!v) return
    const start = offFromStr(v)
    setOff(o.id, { startDay: start, dur: Math.max(start, lastDay(o)) - start + 1 })
  }
  const setTo = (o: TimeOff, v: string) => {
    if (!v) return
    setOff(o.id, { dur: Math.max(o.startDay, offFromStr(v)) - o.startDay + 1 })
  }
  const addOff = () =>
    patchRF({ timeOff: [...rform.timeOff, { id: 'o' + Date.now(), startDay: getTodayDay(), dur: 5, note: '' }] })
  const removeOff = (id: string) => patchRF({ timeOff: rform.timeOff.filter(o => o.id !== id) })

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[440px] max-h-[90vh] flex flex-col">
        <div className="px-5 pt-5 pb-4 border-b border-[#ececec]">
          <h2 className="text-sm font-semibold text-[#18181b]">{rform.id ? t('Edit resource') : t('Add resource')}</h2>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4 overflow-y-auto">
          <div>
            <div className={labelCls}>{t('Name')}</div>
            <input className={inputCls} value={rform.name} onChange={e => patchRF({ name: e.target.value })} placeholder={t('Full name')} />
          </div>
          <div>
            <div className={labelCls}>{t('Role')}</div>
            <div className="flex items-center gap-2">
              {(() => {
                const { Icon } = roleIconDef(roles.find(r => r.name === rform.role)?.icon)
                return (
                  <div className="w-9 h-9 rounded-lg bg-[#f4f4f5] flex items-center justify-center flex-none">
                    <Icon size={10} className="text-[#52525b]" />
                  </div>
                )
              })()}
              <select className={`${inputCls} flex-1 min-w-0`} value={rform.role} onChange={e => patchRF({ role: e.target.value })}>
                {roles.map(r => <option key={r.name} value={r.name}>{t(r.name)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <div className={labelCls}>{t('Cost')} ({settings.currencySymbol})</div>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                step={rform.costUnit === 'hour' ? 1 : 100}
                className={`${inputCls} flex-1 min-w-0`}
                value={rform.cost}
                onChange={e => patchRF({ cost: Math.max(0, Number(e.target.value) || 0) })}
                placeholder="0"
              />
              <div className="flex rounded-lg border border-[#ececec] overflow-hidden shrink-0 text-[12px] font-semibold">
                <button
                  type="button"
                  onClick={() => patchRF({ costUnit: 'month' })}
                  className={`px-3 py-2 cursor-pointer font-inherit ${rform.costUnit === 'month' ? 'bg-[#18181b] text-white' : 'bg-white text-[#71717a]'}`}
                >
                  {t('/mo')}
                </button>
                <button
                  type="button"
                  onClick={() => patchRF({ costUnit: 'hour' })}
                  className={`px-3 py-2 cursor-pointer font-inherit border-l border-[#ececec] ${rform.costUnit === 'hour' ? 'bg-[#18181b] text-white' : 'bg-white text-[#71717a]'}`}
                >
                  {t('/hr')}
                </button>
              </div>
            </div>
          </div>
          <div>
            <div className={labelCls}>{t('Availability (%)')}</div>
            <input
              type="number"
              min={0}
              max={100}
              step={5}
              className={inputCls}
              value={rform.availability}
              onChange={e => patchRF({ availability: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
              placeholder="100"
            />
            <p className="text-[11px] text-[#a1a1aa] mt-1.5">{t('Share of their time available for this roadmap. Assignments above it count as overload.')}</p>
          </div>
          <div>
            <div className={labelCls}>{t('Absences')}</div>
            <div className="flex flex-col gap-2">
              {rform.timeOff.map(o => (
                <div key={o.id} className="flex flex-col gap-1.5 rounded-lg border border-[#f1f1f1] p-2">
                  <div className="flex items-center gap-1.5">
                    <input type="date" className={`${inputCls} py-1.5 min-w-0`} value={dateStr(o.startDay)} onChange={e => setFrom(o, e.target.value)} aria-label={t('From')} />
                    <span className="text-[12px] text-[#a1a1aa]">→</span>
                    <input type="date" className={`${inputCls} py-1.5 min-w-0`} value={dateStr(lastDay(o))} onChange={e => setTo(o, e.target.value)} aria-label={t('To')} />
                    <button
                      type="button"
                      onClick={() => removeOff(o.id)}
                      title={t('Remove time off')}
                      className="flex-none w-7 h-7 rounded-md border-none bg-transparent text-[#a1a1aa] hover:bg-[#f4f4f5] hover:text-[#c0584f] cursor-pointer text-base leading-none"
                    >
                      ×
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      className={`${inputCls} py-1.5 flex-1 min-w-0`}
                      value={o.note ?? ''}
                      onChange={e => setOff(o.id, { note: e.target.value })}
                      placeholder={t('Note (vacation, leave…)')}
                    />
                    <span className="flex-none text-[11px] text-[#a1a1aa] tabular-nums">{t('{n} working days', { n: workingDaysInRange(o.startDay, o.dur, settings) })}</span>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addOff}
                className="self-start text-[12px] font-semibold text-[#3b6ef5] bg-transparent border-none cursor-pointer font-inherit p-0 hover:underline"
              >
                + {t('Add time off')}
              </button>
            </div>
            <p className="text-[11px] text-[#a1a1aa] mt-1.5">{t('Their capacity is 0 on those days: work assigned then is flagged, and dates are not moved.')}</p>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-[#ececec] flex gap-2">
          {rform.canDelete && (
            <button onClick={onRDelete} className="border border-[#f0d9d6] text-[#c0584f] bg-white rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer font-inherit">
              {t('Remove')}
            </button>
          )}
          <button onClick={onRCancel} className="flex-1 border border-[#ececec] text-[#52525b] bg-white rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer font-inherit">
            {t('Cancel')}
          </button>
          <button onClick={onRSave} className="flex-1 bg-[#18181b] text-white border-none rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer font-inherit">
            {rform.id ? t('Save') : t('Add')}
          </button>
        </div>
      </div>
    </div>
  )
}
