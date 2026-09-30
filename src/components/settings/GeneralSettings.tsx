'use client'

import { useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import { DEFAULT_PROJECT_TASKS } from '@/data/initialData'
import { useTranslation } from '@/lib/i18n/useTranslation'

const labelCls = 'text-[11px] font-semibold text-[#71717a] mb-1.5'
const inputCls = 'w-full text-[13px] text-[#27272a] bg-white border border-[#ececec] rounded-lg px-2.5 py-2 font-inherit'

export default function GeneralSettings() {
  const { settings, patchSettings } = useRoadmapStore()
  const { t } = useTranslation()
  const tasks = settings.defaultProjectTasks ?? DEFAULT_PROJECT_TASKS
  const isBuiltinTasks = tasks.length === DEFAULT_PROJECT_TASKS.length && tasks.every((x, i) => x === DEFAULT_PROJECT_TASKS[i])
  const [newTask, setNewTask] = useState('')
  const setTasks = (next: string[]) => patchSettings({ defaultProjectTasks: next })
  const addTask = () => {
    const name = newTask.trim()
    if (!name) return
    setTasks([...tasks, name])
    setNewTask('')
  }
  const moveTask = (i: number, to: number) => {
    const next = [...tasks]
    ;[next[i], next[to]] = [next[to], next[i]]
    setTasks(next)
  }
  const iconBtn = 'flex-none text-[#a1a1aa] cursor-pointer border-none bg-transparent p-0 disabled:opacity-30 disabled:cursor-default'

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className={labelCls}>{t('Default tasks for new projects')}</div>
        <p className="text-[11px] text-[#a1a1aa] mb-2">{t('When creating a project you can add these tasks, in this order, spread across its dates.')}</p>
        <div className="flex flex-col gap-1.5 mb-2">
          {tasks.map((task, i) => (
            <div key={i} className="flex items-center gap-2 pl-1 pr-[9px] py-1 border border-[#f1f1f1] rounded-lg">
              <input
                className="flex-1 min-w-0 text-[12px] text-[#27272a] bg-transparent border-none px-1.5 py-1 font-inherit"
                value={task}
                onChange={e => setTasks(tasks.map((x, j) => j === i ? e.target.value : x))}
                onBlur={() => { if (!task.trim()) setTasks(tasks.filter((_, j) => j !== i)) }}
                aria-label={`${t('Task')} ${i + 1}`}
              />
              <button onClick={() => moveTask(i, i - 1)} disabled={i === 0} className={iconBtn} title={t('Move up')} aria-label={t('Move up')}><ChevronUp size={14} /></button>
              <button onClick={() => moveTask(i, i + 1)} disabled={i === tasks.length - 1} className={iconBtn} title={t('Move down')} aria-label={t('Move down')}><ChevronDown size={14} /></button>
              <button onClick={() => setTasks(tasks.filter((_, j) => j !== i))} className="flex-none text-[#a1a1aa] text-sm cursor-pointer border-none bg-transparent p-0" title={t('Remove')} aria-label={t('Remove')}>×</button>
            </div>
          ))}
          {tasks.length === 0 && (
            <p className="text-[12px] text-[#a1a1aa]">{t('No default tasks: new projects start empty.')}</p>
          )}
        </div>
        <div className="flex gap-2">
          <input
            className={inputCls}
            value={newTask}
            onChange={e => setNewTask(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addTask() }}
            placeholder={t('New task name')}
          />
          <button
            onClick={addTask}
            className="flex-none border border-[#ececec] text-[#52525b] bg-white rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer font-inherit"
          >
            {t('Add')}
          </button>
        </div>
        {!isBuiltinTasks && (
          <button
            onClick={() => patchSettings({ defaultProjectTasks: undefined })}
            className="mt-2 text-[11px] text-[#71717a] underline cursor-pointer border-none bg-transparent p-0 font-inherit"
          >
            {t('Restore defaults')}
          </button>
        )}
      </div>
    </div>
  )
}
