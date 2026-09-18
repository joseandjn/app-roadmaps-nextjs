'use client'

import { useRoadmapStore } from '@/store/useRoadmapStore'
import { useTranslation } from '@/lib/i18n/useTranslation'

const labelCls = 'text-[11px] font-semibold text-[#71717a] mb-1.5'
const inputCls = 'w-full text-[13px] text-[#27272a] bg-white border border-[#ececec] rounded-lg px-2.5 py-2 font-inherit'

export default function SprintModal() {
  const { sform, patchSF, onSFSave, onSFCancel, onSFDelete } = useRoadmapStore()
  const { t } = useTranslation()

  if (!sform?.show) return null

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[380px] flex flex-col">
        <div className="px-5 pt-5 pb-4 border-b border-[#ececec]">
          <h2 className="text-sm font-semibold text-[#18181b]">{sform.id ? t('Edit sprint') : t('Add sprint')}</h2>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          <div>
            <div className={labelCls}>{t('Sprint name')}</div>
            <input className={inputCls} value={sform.name} onChange={e => patchSF({ name: e.target.value })} placeholder="Sprint 1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className={labelCls}>{t('Start')}</div>
              <input type="date" className={inputCls} value={sform.startStr} onChange={e => patchSF({ startStr: e.target.value })} />
            </div>
            <div>
              <div className={labelCls}>{t('End')}</div>
              <input type="date" className={inputCls} value={sform.endStr} onChange={e => patchSF({ endStr: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-[#ececec] flex gap-2">
          {sform.canDelete && (
            <button onClick={onSFDelete} className="border border-[#f0d9d6] text-[#c0584f] bg-white rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer font-inherit">
              {t('Delete')}
            </button>
          )}
          <button onClick={onSFCancel} className="flex-1 border border-[#ececec] text-[#52525b] bg-white rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer font-inherit">
            {t('Cancel')}
          </button>
          <button onClick={onSFSave} className="flex-1 bg-[#18181b] text-white border-none rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer font-inherit">
            {sform.id ? t('Save') : t('Add sprint')}
          </button>
        </div>
      </div>
    </div>
  )
}
