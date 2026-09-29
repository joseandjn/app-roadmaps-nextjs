'use client'

import { useEffect, useRef } from 'react'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { fmtDate, addDays } from '@/lib/roadmapUtils'
import { useFilterContext } from '@/lib/useFilterContext'
import { itemMatch } from '@/lib/filters'
import type { ItemType } from '@/types'

const CREATE_OPTIONS: { type: ItemType; label: string }[] = [
  { type: 'task', label: 'New task' },
  { type: 'epic', label: 'New epic' },
  { type: 'milestone', label: 'New milestone' },
  { type: 'release', label: 'New release' },
]

const MENU_W = 210

export default function ContextMenu() {
  const { contextMenu, closeContextMenu, openItem, newItemAt, duplicateItem, deleteItemById, setFilters, items, selectedIds, toggleSelected, setSelected, openCopy } = useRoadmapStore()
  const fctx = useFilterContext()
  const ref = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()

  useEffect(() => {
    if (!contextMenu) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) closeContextMenu()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeContextMenu() }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', closeContextMenu, true)
    window.addEventListener('resize', closeContextMenu)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', closeContextMenu, true)
      window.removeEventListener('resize', closeContextMenu)
    }
  }, [contextMenu, closeContextMenu])

  if (!contextMenu) return null
  const { x, y, projectId, day, itemId } = contextMenu
  const left = typeof window !== 'undefined' ? Math.min(x, window.innerWidth - MENU_W - 8) : x
  const top = typeof window !== 'undefined' ? Math.min(y, window.innerHeight - 220) : y

  const itemBtn = 'w-full text-left px-3 py-2 text-[13px] text-[#27272a] bg-transparent border-none cursor-pointer rounded-md hover:bg-[#f4f4f5] font-inherit'
  const dangerBtn = 'w-full text-left px-3 py-2 text-[13px] text-[#c0584f] bg-transparent border-none cursor-pointer rounded-md hover:bg-[#fdeceb] font-inherit'

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', left, top, zIndex: 200, width: MENU_W }}
      className="bg-white border border-[#ececec] rounded-xl shadow-[0_8px_28px_rgba(0,0,0,0.14)] py-1.5"
    >
      {itemId ? (
        <>
          <button className={itemBtn} onClick={() => { openItem(itemId); closeContextMenu() }}>{t('Edit')}</button>
          <button className={itemBtn} onClick={() => { duplicateItem(itemId); closeContextMenu() }}>{t('Duplicate')}</button>
          <button className={itemBtn} onClick={() => { setFilters({ focusItemId: itemId }); closeContextMenu() }}>{t('Show dependency path')}</button>
          <div className="h-px bg-[#f1f1f1] my-1.5 mx-2" />
          <button className={itemBtn} onClick={() => { toggleSelected(itemId); closeContextMenu() }}>
            {selectedIds.includes(itemId) ? t('Remove from selection') : t('Add to selection')}
          </button>
          {selectedIds.length > 0 && <button className={itemBtn} onClick={openCopy}>{t('Copy selection to…')}</button>}
          <div className="h-px bg-[#f1f1f1] my-1.5 mx-2" />
          <button className={dangerBtn} onClick={() => { deleteItemById(itemId); closeContextMenu() }}>{t('Delete')}</button>
        </>
      ) : (
        <>
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#a1a1aa]">{fmtDate(addDays(day))}</div>
          {CREATE_OPTIONS.map(({ type, label }) => (
            <button key={type} className={itemBtn} onClick={() => { newItemAt(projectId, day, type); closeContextMenu() }}>
              {t(label)}
            </button>
          ))}
          <div className="h-px bg-[#f1f1f1] my-1.5 mx-2" />
          <button className={itemBtn} onClick={() => {
            // The project's items the filters show, added to the selection.
            const ids = items.filter(i => i.projectId === projectId && itemMatch(i, fctx) !== 'hide').map(i => i.id)
            setSelected([...selectedIds, ...ids])
            closeContextMenu()
          }}>{t('Select project tasks')}</button>
          {selectedIds.length > 0 && <button className={itemBtn} onClick={openCopy}>{t('Copy selection to…')}</button>}
        </>
      )}
    </div>
  )
}
