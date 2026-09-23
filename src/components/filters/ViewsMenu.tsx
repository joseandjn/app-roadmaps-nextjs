'use client'

import { useEffect, useRef, useState } from 'react'
import { Bookmark, ChevronDown, Pencil, Trash2 } from 'lucide-react'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { BUILTIN_VIEWS, currentViewSnapshot, sameViewSnapshot } from '@/lib/filters'

// Views menu, first in the FilterBar: apply a built-in or saved view, save
// the current filters under a name, rename or delete your own. The button
// shows the view last applied, marked "(modified)" once filters drift from it.
export default function ViewsMenu() {
  const s = useRoadmapStore()
  const { savedViews, activeViewId, applyView, saveCurrentView, renameSavedView, deleteSavedView } = s
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey) }
  }, [open])

  const active = [...BUILTIN_VIEWS, ...savedViews].find(v => v.id === activeViewId)
  const isBuiltin = (id: string) => BUILTIN_VIEWS.some(v => v.id === id)
  const label = active ? (isBuiltin(active.id) ? t(active.name) : active.name) : t('Views')
  const modified = !!active && !sameViewSnapshot(currentViewSnapshot(s), active)

  const apply = (id: string) => { applyView(id); setOpen(false) }
  const save = () => { if (newName.trim()) { saveCurrentView(newName); setNewName('') } }
  const commitRename = () => { if (editing) renameSavedView(editing.id, editing.name); setEditing(null) }

  const row = 'flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[#f4f4f5]'
  const section = 'px-3 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#a1a1aa]'
  const iconBtn = 'flex-none w-5 h-5 flex items-center justify-center rounded border-none bg-transparent cursor-pointer p-0 text-[#a1a1aa] hover:text-[#27272a]'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(o => !o); setEditing(null) }}
        className="flex items-center gap-1.5 text-[12px] font-medium rounded-lg px-2.5 py-1.5 border cursor-pointer font-inherit whitespace-nowrap max-w-[220px]"
        style={active
          ? { color: '#3b6ef5', background: '#eaf1ff', borderColor: '#c2d4ff' }
          : { color: '#52525b', background: '#fff', borderColor: '#ececec' }}
      >
        <Bookmark size={12} className="flex-none" />
        <span className="truncate">{label}{modified && ` ${t('(modified)')}`}</span>
        <ChevronDown size={12} className="opacity-60 flex-none" />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-[150] w-[260px] bg-white border border-[#ececec] rounded-xl shadow-[0_8px_28px_rgba(0,0,0,0.14)] py-1.5">
          <div className={section}>{t('Ready-made')}</div>
          <div className="px-1.5">
            {BUILTIN_VIEWS.map(v => (
              <button key={v.id} onClick={() => apply(v.id)}
                className={`${row} w-full text-left text-[13px] text-[#27272a] border-none bg-transparent cursor-pointer font-inherit`}
                style={v.id === activeViewId ? { background: '#f1f5fd' } : undefined}>
                {t(v.name)}
              </button>
            ))}
          </div>

          <div className={`${section} mt-1 border-t border-[#f1f1f1]`}>{t('My views')}</div>
          <div className="px-1.5 max-h-[220px] overflow-y-auto">
            {savedViews.map(v => editing?.id === v.id ? (
              <div key={v.id} className="px-1 py-1">
                <input autoFocus value={editing.name}
                  onChange={e => setEditing({ id: v.id, name: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { e.stopPropagation(); setEditing(null) } }}
                  onBlur={commitRename}
                  className="w-full text-[13px] text-[#27272a] border border-[#c2d4ff] rounded-md px-2 py-1 font-inherit outline-none" />
              </div>
            ) : (
              <div key={v.id} className={row} style={v.id === activeViewId ? { background: '#f1f5fd' } : undefined}>
                <button onClick={() => apply(v.id)} className="flex-1 min-w-0 text-left text-[13px] text-[#27272a] truncate border-none bg-transparent cursor-pointer font-inherit p-0">
                  {v.name}
                </button>
                <button onClick={() => setEditing({ id: v.id, name: v.name })} title={t('Rename')} className={iconBtn}><Pencil size={11} /></button>
                <button onClick={() => deleteSavedView(v.id)} title={t('Delete')} className={iconBtn}><Trash2 size={11} /></button>
              </div>
            ))}
            {savedViews.length === 0 && <div className="px-2 py-1.5 text-[12px] text-[#a1a1aa]">{t('No saved views yet')}</div>}
          </div>

          <div className="flex gap-1.5 px-3 pt-2 mt-1 border-t border-[#f1f1f1]">
            <input value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') save() }}
              placeholder={t('Name for current view…')}
              className="flex-1 min-w-0 text-[12px] text-[#27272a] border border-[#ececec] rounded-lg px-2.5 py-1.5 bg-white font-inherit outline-none focus:border-[#c2d4ff]" />
            <button onClick={save} disabled={!newName.trim()}
              className="text-[11px] font-semibold text-white bg-[#18181b] border-none rounded-lg px-2.5 py-1.5 cursor-pointer font-inherit disabled:opacity-40 disabled:cursor-default">
              {t('Save')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
