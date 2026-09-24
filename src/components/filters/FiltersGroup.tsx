'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/useTranslation'

// Narrow screens: the filter chips move into one "Filters · N" popover so
// the bar doesn't overflow. The chips open their own popovers inside it;
// those are DOM children, so clicking in them doesn't close this one.
export default function FiltersGroup({ count, children }: { count: number; children: ReactNode }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    // Esc closes a chip's popover first; this one only when no chip is open.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !ref.current?.querySelector('.z-\\[150\\]')) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const active = count > 0
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-[12px] font-medium rounded-lg px-2.5 py-1.5 border cursor-pointer font-inherit whitespace-nowrap"
        style={active
          ? { color: '#3b6ef5', background: '#eaf1ff', borderColor: '#c2d4ff' }
          : { color: '#52525b', background: '#fff', borderColor: '#ececec' }}
      >
        <SlidersHorizontal size={12} />
        {t('Filters')}
        {active && <span className="tabular-nums font-semibold">· {count}</span>}
        <ChevronDown size={12} className="opacity-60" />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-[140] w-[360px] flex flex-wrap gap-1.5 bg-white border border-[#ececec] rounded-xl shadow-[0_8px_28px_rgba(0,0,0,0.14)] p-2">
          {children}
        </div>
      )}
    </div>
  )
}
