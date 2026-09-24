'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useFilterContext } from '@/lib/useFilterContext'
import { itemMatch, matchesText } from '@/lib/filters'
import { scrollToItem } from '@/lib/scrollToItem'

const DEBOUNCE_MS = 150
const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

// Text search (filters.text): non-matching items are dimmed by itemMatch.
// Enter scrolls to the next match drawn in the current view (bars carry
// data-item-id) and flashes it. `/` or Cmd/Ctrl+F focus the field; Esc
// clears it. Not persisted.
export default function SearchBox() {
  const storeText = useRoadmapStore(s => s.filters.text)
  const items = useRoadmapStore(s => s.items)
  const setFilters = useRoadmapStore(s => s.setFilters)
  const { t } = useTranslation()
  const fctx = useFilterContext()
  const inputRef = useRef<HTMLInputElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [value, setValue] = useState(storeText)
  const [cursor, setCursor] = useState(-1)

  // Follow outside changes (Reset, applying a view) without fighting typing:
  // while the debounce is pending the store still holds the old text.
  const [seenStore, setSeenStore] = useState(storeText)
  if (storeText !== seenStore) {
    setSeenStore(storeText)
    if (storeText !== value) {
      setValue(storeText)
      setCursor(-1)
    }
  }

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const commit = (v: string) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setFilters({ text: v }), DEBOUNCE_MS)
  }

  const onChange = (v: string) => {
    setValue(v)
    setCursor(-1)
    commit(v)
  }

  const clear = () => {
    if (timer.current) clearTimeout(timer.current)
    setValue('')
    setCursor(-1)
    setFilters({ text: '' })
  }

  // Matches among the items the other filters keep, in time order (title
  // breaks ties). Uses the typed value, so the count and Enter don't wait
  // for the debounce.
  const active = value.trim() !== ''
  const matches = useMemo(() => active
    ? items
        .filter(i => itemMatch(i, fctx) !== 'hide' && matchesText(i, value, fctx.projects))
        .sort((a, b) => a.startDay - b.startDay || a.title.localeCompare(b.title))
    : [], [active, value, items, fctx])

  const goNext = (back: boolean) => {
    // Only matches the current view actually draws (date window, collapsed
    // lanes and non-timeline views leave some out).
    const drawn = matches.filter(m => document.querySelector(`[data-item-id="${m.id}"]`))
    if (!drawn.length) return
    const at = drawn.findIndex(m => m.id === matches[cursor]?.id)
    const next = at < 0 ? (back ? drawn.length - 1 : 0) : (at + (back ? -1 : 1) + drawn.length) % drawn.length
    scrollToItem(drawn[next].id)
    setCursor(matches.indexOf(drawn[next]))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isSlash = e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey
      const isFind = e.key.toLowerCase() === 'f' && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey
      if (!isSlash && !isFind) return
      const el = e.target as HTMLElement | null
      if (el && (el.isContentEditable || EDITABLE_TAGS.has(el.tagName) || el.closest('[role="dialog"]'))) return
      e.preventDefault()
      inputRef.current?.focus()
      inputRef.current?.select()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      // Flush the debounce so the dimming matches what Enter jumps to.
      if (value !== storeText) {
        if (timer.current) clearTimeout(timer.current)
        setFilters({ text: value })
      }
      goNext(e.shiftKey)
    } else if (e.key === 'Escape') {
      clear()
      inputRef.current?.blur()
    }
  }

  return (
    <div className="flex items-center gap-1.5 text-[12px] rounded-lg pl-2 pr-1.5 py-1.5 border bg-white whitespace-nowrap"
      style={{ borderColor: active ? '#c2d4ff' : '#ececec' }}>
      <Search size={12} className="flex-none text-[#a1a1aa]" />
      <input
        ref={inputRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={t('Search items…')}
        title={t('Search by item or project name (/ or ⌘F). Enter jumps to the next match.')}
        className="w-[130px] text-[12px] text-[#27272a] bg-transparent border-none outline-none p-0 font-inherit placeholder:text-[#a1a1aa]"
      />
      {active && (
        <span className="tabular-nums text-[11px] font-medium" style={{ color: matches.length ? '#3b6ef5' : '#a1a1aa' }}>
          {cursor >= 0 ? `${cursor + 1}/${matches.length}` : matches.length}
        </span>
      )}
      {value && (
        <button
          onClick={clear}
          title={t('Clear search')}
          className="flex-none flex items-center justify-center w-4 h-4 rounded border-none bg-transparent cursor-pointer p-0 text-[#71717a] hover:bg-[#f4f4f5]"
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}
