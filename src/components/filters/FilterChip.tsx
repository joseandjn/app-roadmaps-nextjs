'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from '@/lib/i18n/useTranslation'

export interface FilterOption {
  value: string
  label: string
  hint?: string // secondary text, e.g. a person's role
  color?: string // swatch, e.g. project color or status dot
  icon?: ReactNode
}

interface Props {
  label: string
  options: FilterOption[]
  selected: string[]
  onToggle: (value: string) => void
  onSetAll: (values: string[]) => void
  // Extra controls rendered above the list (shortcuts like "Hide Done").
  header?: ReactNode
}

const SEARCH_THRESHOLD = 8

// A multi-select filter in the FilterBar: a chip showing the label and how
// many values are picked, opening a checklist popover. Nothing selected
// means "no restriction" — the chip just reads as its label.
export default function FilterChip({ label, options, selected, onToggle, onSetAll, header }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const active = selected.length > 0
  const q = query.trim().toLowerCase()
  const shown = q
    ? options.filter(o => o.label.toLowerCase().includes(q) || o.hint?.toLowerCase().includes(q))
    : options

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(o => !o); setQuery('') }}
        className="flex items-center gap-1.5 text-[12px] font-medium rounded-lg px-2.5 py-1.5 border cursor-pointer font-inherit whitespace-nowrap"
        style={active
          ? { color: '#3b6ef5', background: '#eaf1ff', borderColor: '#c2d4ff' }
          : { color: '#52525b', background: '#fff', borderColor: '#ececec' }}
      >
        {label}
        {active && <span className="tabular-nums font-semibold">· {selected.length}</span>}
        <span className="text-[9px] opacity-60">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-[150] w-[240px] bg-white border border-[#ececec] rounded-xl shadow-[0_8px_28px_rgba(0,0,0,0.14)] py-1.5">
          {header && <div className="px-1.5 pb-1.5 mb-1 border-b border-[#f1f1f1]">{header}</div>}

          {options.length > SEARCH_THRESHOLD && (
            <div className="px-2 pb-1.5">
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t('Search…')}
                className="w-full text-[12px] text-[#27272a] border border-[#ececec] rounded-lg px-2.5 py-1.5 bg-white font-inherit outline-none focus:border-[#c2d4ff]"
              />
            </div>
          )}

          <div className="max-h-[280px] overflow-y-auto px-1.5">
            {shown.map(o => {
              const on = selected.includes(o.value)
              return (
                <label key={o.value} className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-[#f4f4f5]">
                  <input type="checkbox" checked={on} onChange={() => onToggle(o.value)} className="accent-[#3b6ef5] cursor-pointer" />
                  {o.color && <span className="w-2 h-2 rounded-[3px] flex-none" style={{ background: o.color }} />}
                  {o.icon}
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] text-[#27272a] truncate">{o.label}</span>
                    {o.hint && <span className="block text-[11px] text-[#a1a1aa] truncate">{o.hint}</span>}
                  </span>
                </label>
              )
            })}
            {shown.length === 0 && <div className="px-2 py-2 text-[12px] text-[#a1a1aa]">{t('No matches')}</div>}
          </div>

          <div className="flex justify-between gap-2 px-3 pt-1.5 mt-1 border-t border-[#f1f1f1]">
            <button onClick={() => onSetAll(options.map(o => o.value))} className="text-[11px] font-semibold text-[#52525b] bg-transparent border-none cursor-pointer font-inherit p-0 hover:text-[#27272a]">
              {t('Select all')}
            </button>
            <button onClick={() => onSetAll([])} disabled={!active} className="text-[11px] font-semibold text-[#52525b] bg-transparent border-none cursor-pointer font-inherit p-0 hover:text-[#27272a] disabled:opacity-40 disabled:cursor-default">
              {t('Clear')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
