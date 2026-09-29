'use client'

import { useRoadmapStore } from '@/store/useRoadmapStore'
import { STATUS_ORDER, CATEGORIES } from '@/data/initialData'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { projectTaskTemplate } from '@/lib/roadmapUtils'

const labelCls = 'text-[11px] font-semibold text-[#71717a] mb-1.5'
const inputCls = 'w-full text-[13px] text-[#27272a] bg-white border border-[#ececec] rounded-lg px-2.5 py-2 font-inherit'

export default function ProjectModal() {
  const { pform, resources, settings, items, patchPF, onPSave, onPCancel, onPDelete, resetProjectLanes } = useRoadmapStore()
  const { t } = useTranslation()
  const tasks = projectTaskTemplate(settings)

  if (!pform?.show) return null
  // Rows set by dragging tasks up/down in the Timeline.
  const manualOrder = !!pform.id && items.some(i => i.projectId === pform.id && i.lane !== undefined)

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[440px] flex flex-col max-h-[90vh]">
        <div className="px-5 pt-5 pb-4 border-b border-[#ececec]">
          <h2 className="text-sm font-semibold text-[#18181b]">{pform.heading ?? (pform.id ? t('Edit project') : t('New project'))}</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          <div>
            <div className={labelCls}>{t('Name')}</div>
            <input className={inputCls} value={pform.name} onChange={e => patchPF({ name: e.target.value })} placeholder={t('Project name')} />
          </div>
          <div>
            <div className={labelCls}>{t('Description')}</div>
            <textarea className={`${inputCls} resize-none`} rows={2} value={pform.desc} onChange={e => patchPF({ desc: e.target.value })} placeholder={t('What is this project about?')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className={labelCls}>{t('Owner')}</div>
              <select className={inputCls} value={pform.owner} onChange={e => patchPF({ owner: e.target.value })}>
                {resources.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <div className={labelCls}>{t('Category')}</div>
              <select className={inputCls} value={pform.category} onChange={e => patchPF({ category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c} value={c}>{t(c)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <div className={labelCls}>{t('Status')}</div>
            <select className={inputCls} value={pform.status} onChange={e => patchPF({ status: e.target.value as typeof pform.status })}>
              {STATUS_ORDER.map(s => <option key={s} value={s}>{t(s)}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className={labelCls}>{t('Start')}</div>
              <input type="date" className={inputCls} value={pform.startStr} onChange={e => patchPF({ startStr: e.target.value })} />
            </div>
            <div>
              <div className={labelCls}>{t('End')}</div>
              <input type="date" className={inputCls} value={pform.endStr} onChange={e => patchPF({ endStr: e.target.value })} />
            </div>
          </div>
          {!pform.id && tasks.length > 0 && (
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={pform.defaultTasks ?? false}
                onChange={e => patchPF({ defaultTasks: e.target.checked })}
              />
              <span className="text-[13px] text-[#27272a]">
                {t('Add default tasks')}
                <span className="block text-[11px] text-[#a1a1aa] mt-0.5">
                  {t('{tasks} — spread evenly across the Start–End range above. Edit them in Settings → General.', { tasks: tasks.join(', ') })}
                </span>
              </span>
            </label>
          )}
          {manualOrder && (
            <div>
              <div className={labelCls}>{t('Task order')}</div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[12px] text-[#71717a] leading-snug">{t('Tasks stay in the rows you dragged them to in the Timeline.')}</span>
                <button onClick={() => resetProjectLanes(pform.id!)} className="flex-none border border-[#ececec] text-[#52525b] bg-white rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer font-inherit">
                  {t('Automatic order')}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-[#ececec] flex gap-2">
          {pform.canDelete && (
            <button onClick={onPDelete} className="border border-[#f0d9d6] text-[#c0584f] bg-white rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer font-inherit">
              {t('Delete')}
            </button>
          )}
          <button onClick={onPCancel} className="flex-1 border border-[#ececec] text-[#52525b] bg-white rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer font-inherit">
            {t('Cancel')}
          </button>
          <button onClick={onPSave} className="flex-1 bg-[#18181b] text-white border-none rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer font-inherit">
            {pform.id ? t('Save') : t('Create project')}
          </button>
        </div>
      </div>
    </div>
  )
}
