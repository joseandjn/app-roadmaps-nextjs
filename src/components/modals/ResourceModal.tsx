'use client'

import { useRoadmapStore } from '@/store/useRoadmapStore'
import { roleIconDef } from '@/data/roleIcons'
import { useTranslation } from '@/lib/i18n/useTranslation'

const labelCls = 'text-[11px] font-semibold text-[#71717a] mb-1.5'
const inputCls = 'w-full text-[13px] text-[#27272a] bg-white border border-[#ececec] rounded-lg px-2.5 py-2 font-inherit'

export default function ResourceModal() {
  const { rform, settings, roles, patchRF, onRSave, onRCancel, onRDelete } = useRoadmapStore()
  const { t } = useTranslation()

  if (!rform?.show) return null

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[380px] flex flex-col">
        <div className="px-5 pt-5 pb-4 border-b border-[#ececec]">
          <h2 className="text-sm font-semibold text-[#18181b]">{rform.id ? t('Edit resource') : t('Add resource')}</h2>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
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
