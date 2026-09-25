'use client'

import React, { useRef, useCallback, useEffect, useMemo, useState } from 'react'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import { deriveScale, buckets, buildHeader, initials, allocColor, utilizationPct, assignedDuringTimeOff } from '@/lib/roadmapUtils'
import { getTodayDay } from '@/data/initialData'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useFilterContext } from '@/lib/useFilterContext'
import { useTodayDay } from '@/lib/useTodayDay'
import { usePlanEnd } from '@/lib/usePlanEnd'
import { itemsForMetrics, colorLoad, resourceMatches } from '@/lib/filters'
import FilterEmptyState from '@/components/filters/FilterEmptyState'
import UncoveredDemand from '@/components/UncoveredDemand'
import TimeOffPopover, { type TimeOffPopoverState } from '@/components/TimeOffPopover'

const RH = 46
const LABEL_W = 264
const HEADER_H = 54

export default function ResourcesView() {
  const { pxPerDay, resources, items, projects, settings, filterStartDay, filterEndDay, filters, openCell, setViewport } = useRoadmapStore()
  const { t } = useTranslation()
  const fctx = useFilterContext()
  const todayDay = useTodayDay()
  const scrollRef = useRef<HTMLDivElement>(null)
  const si = deriveScale(pxPerDay)
  const ppd = pxPerDay
  const baseDay   = Math.max(0, filterStartDay ?? 0)
  const lastDay   = usePlanEnd()
  const visibleDays = Math.max(1, lastDay - baseDay)
  const totalWidth = visibleDays * ppd
  const rows = useMemo(() => resources.filter(r => resourceMatches(r, filters)), [resources, filters])
  const countedItems = useMemo(() => itemsForMetrics(items, fctx), [items, fctx])
  const counted = useMemo(() => new Set(countedItems.map(i => i.id)), [countedItems])
  // Nobody left, or every item filtered out (the rows would all read 0%).
  const filteredEmpty = (resources.length > 0 && rows.length === 0) || (items.length > 0 && counted.size === 0)

  // Drag over a row to add time off: `sel` is the live selection (inclusive
  // days), `popover` the quick form opened on release or by clicking a band.
  const canvasRef = useRef<HTMLDivElement>(null)
  const [sel, setSel] = useState<{ rid: string; row: number; a: number; b: number } | null>(null)
  const [popover, setPopover] = useState<TimeOffPopoverState | null>(null)
  const suppressClick = useRef(false)

  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const row = Math.floor((e.clientY - rect.top) / RH)
    const r = rows[row]
    if (!r) return
    const dayAt = (clientX: number) => Math.min(lastDay - 1, Math.max(baseDay, baseDay + Math.floor((clientX - rect.left) / ppd)))
    const startX = e.clientX
    const a = dayAt(startX)
    let dragging = false
    let b = a
    const move = (ev: PointerEvent) => {
      if (!dragging && Math.abs(ev.clientX - startX) < 5) return
      dragging = true
      b = dayAt(ev.clientX)
      setSel({ rid: r.id, row, a, b })
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setSel(null)
      if (!dragging) return // a plain click: the cell opens its panel as before
      suppressClick.current = true
      setTimeout(() => { suppressClick.current = false }, 0)
      const s = Math.min(a, b), en = Math.max(a, b)
      setPopover({ rid: r.id, entry: { id: 'o' + Date.now(), startDay: s, dur: en - s + 1, note: '' }, isNew: true, x: ev.clientX, y: ev.clientY })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const syncViewport = useCallback(() => {
    const el = scrollRef.current
    if (el) setViewport({ left: el.scrollLeft, width: el.clientWidth })
  }, [setViewport])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const todayOffset = (getTodayDay() - baseDay) * ppd
    el.scrollLeft = Math.max(0, todayOffset - el.clientWidth / 3)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isMountRef = useRef(true)
  useEffect(() => {
    if (isMountRef.current) { isMountRef.current = false; return }
    const el = scrollRef.current
    if (el) el.scrollLeft = 0
  }, [filterStartDay, filterEndDay])

  const bkts = buckets(si, baseDay, lastDay)
  const { bands, gridLines } = buildHeader(si, ppd, totalWidth, rows.length * RH, baseDay, lastDay)
  const todayX = todayDay === null ? null : (todayDay - baseDay) * ppd

  const rowLabels: React.ReactElement[] = []
  const cells: React.ReactElement[] = []

  let y = 0
  for (let ri = 0; ri < rows.length; ri++) {
    const r = rows[ri]

    rowLabels.push(
      <div key={r.id} style={{ position: 'absolute', top: y, left: 0, width: 264, height: RH, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', borderBottom: '1px solid #f4f4f5', boxSizing: 'border-box' }}>
        <div style={{ width: 26, height: 26, borderRadius: 8, background: '#ececef', color: '#52525b', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
          {initials(r.name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#27272a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
          <div style={{ fontSize: 11, color: '#a1a1aa' }}>{t(r.role)}</div>
        </div>
      </div>
    )

    for (let bi = 0; bi < bkts.length; bi++) {
      const b = bkts[bi]
      let total = 0 // load from items the filters keep
      let full = 0  // load from every item, to flag overloads the filters would hide
      const pAgg: Record<string, number> = {}

      const absS = baseDay + b.s
      const absE = baseDay + b.s + b.d
      // Working days of work assigned while the person is away — from every
      // item, like `full`, so a filter never hides it.
      let offConflict = 0
      for (const it of items) {
        if (it.dur <= 0) continue
        if (it.startDay >= absE || it.startDay + it.dur <= absS) continue
        for (const as of it.assignments) {
          if (as.r !== r.id) continue
          full += as.pct
          if (counted.has(it.id)) { total += as.pct; pAgg[it.projectId] = (pAgg[it.projectId] ?? 0) + as.pct }
        }
        offConflict += assignedDuringTimeOff(it, r, settings, absS, absE)
      }

      // Work during time off reads as a problem, like an overload.
      const col = allocColor(offConflict > 0 ? Infinity : utilizationPct(colorLoad(total, full, r), r))
      const w = b.d * ppd
      const show = w > 30 && total > 0
      const outside = full - total

      const projs = Object.keys(pAgg).map(pid => {
        const p = projects.find(pr => pr.id === pid)
        return <div key={pid} style={{ height: 3, borderRadius: 2, background: p?.color ?? '#a1a1aa', flexGrow: pAgg[pid], flexBasis: 0, minWidth: 3 }} />
      })

      cells.push(
        <div
          key={`${r.id}-${bi}`}
          onClick={() => openCell(r.id, bi, b)}
          title={[
            offConflict > 0 ? t('Work assigned during time off ({n} working days)', { n: offConflict }) : '',
            outside > 0 ? t('Total load {full}% ({n}% outside the filters)', { full, n: outside }) : '',
          ].filter(Boolean).join('\n') || undefined}
          style={{ position: 'absolute', left: b.s * ppd + 1, top: y + 5, width: w - 2, height: RH - 10, background: col.bg, border: `1px ${outside > 0 ? 'dashed' : 'solid'} ${col.bd}`, borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, cursor: 'pointer', boxSizing: 'border-box', overflow: 'hidden' }}
        >
          {show && <span style={{ fontSize: 11, fontWeight: 600, color: col.fg, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{total}%</span>}
          {projs.length > 0 && w > 16 && (
            <div style={{ display: 'flex', gap: 2, width: '100%', padding: '0 4px', boxSizing: 'border-box' }}>
              {projs}
            </div>
          )}
        </div>
      )
    }

    // Time off: a striped band over the exact days, on top of the cells.
    // Clicking it edits that entry.
    for (const o of r.timeOff ?? []) {
      const s = Math.max(o.startDay, baseDay), e = Math.min(o.startDay + o.dur, lastDay)
      if (e <= s) continue
      const w = (e - s) * ppd
      cells.push(
        <div
          key={`${r.id}-off-${o.id}`}
          title={t('Click to edit this time off')}
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); setPopover({ rid: r.id, entry: o, isNew: false, x: e.clientX, y: e.clientY }) }}
          style={{ position: 'absolute', left: (s - baseDay) * ppd, top: y + 2, width: w, height: RH - 4, borderRadius: 6, cursor: 'pointer', zIndex: 2, background: 'repeating-linear-gradient(135deg, rgba(113,113,122,0.16) 0 4px, rgba(113,113,122,0) 4px 9px)', border: '1px solid rgba(113,113,122,0.25)', boxSizing: 'border-box', display: 'flex', alignItems: 'flex-start', padding: '2px 5px', overflow: 'hidden' }}
        >
          {w > 70 && <span style={{ fontSize: 9, fontWeight: 600, color: '#52525b', background: 'rgba(255,255,255,0.85)', borderRadius: 3, padding: '0 3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.note || t('Time off')}</span>}
        </div>
      )
    }

    y += RH
  }

  const canvasHeight = Math.max(y, 240)

  return (
    <>
    {filteredEmpty && <FilterEmptyState />}
    {filters.uncovered && <UncoveredDemand items={countedItems} fromDay={baseDay} toDay={lastDay} />}
    <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto" onScroll={syncViewport}>
      <div style={{ display: 'grid', gridTemplateColumns: `${LABEL_W}px ${totalWidth}px`, gridTemplateRows: `${HEADER_H}px ${canvasHeight}px`, minWidth: LABEL_W + totalWidth }}>
        {/* Top-left corner */}
        <div style={{ position: 'sticky', top: 0, left: 0, zIndex: 30, background: '#fff', borderBottom: '1px solid #ececec', borderRight: '1px solid #ececec', display: 'flex', alignItems: 'center', padding: '0 16px' }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#a1a1aa' }}>{t('Resource')}</span>
        </div>
        {/* Top-right: header bands + bucket ticks */}
        <div style={{ position: 'sticky', top: 0, zIndex: 20, background: '#fff', borderBottom: '1px solid #ececec' }}>
          <div style={{ position: 'relative', width: totalWidth, height: HEADER_H, overflow: 'hidden' }}>
            {bands.map((b, i) => <div key={i} style={b.style}>{b.label}</div>)}
            {bkts.map((b, i) => (
              <div key={i} style={{ position: 'absolute', left: b.s * ppd, top: 25, height: 29, display: 'flex', alignItems: 'center', justifyContent: 'center', width: b.d * ppd, boxSizing: 'border-box', borderLeft: '1px solid #f4f4f5', fontSize: 11, color: '#a1a1aa', fontFamily: 'ui-monospace,Menlo,monospace', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                {b.label}
              </div>
            ))}
          </div>
        </div>
        {/* Bottom-left: row labels */}
        <div style={{ position: 'sticky', left: 0, zIndex: 10, background: '#fcfcfd', borderRight: '1px solid #ececec' }}>
          <div style={{ position: 'relative', height: canvasHeight }}>{rowLabels}</div>
        </div>
        {/* Bottom-right: allocation canvas */}
        <div
          ref={canvasRef}
          onPointerDown={onCanvasPointerDown}
          onClickCapture={e => { if (suppressClick.current) e.stopPropagation() }}
          title={t('Drag across a row to add time off')}
          style={{ position: 'relative', width: totalWidth, height: canvasHeight, overflow: 'hidden', userSelect: 'none' }}
        >
          {rows.map((r, i) => (
            <div key={r.id} style={{ position: 'absolute', left: 0, top: i * RH, width: totalWidth, height: RH, background: i % 2 ? '#fcfcfd' : '#fff', borderBottom: '1px solid #f4f4f5' }} />
          ))}
          {gridLines.map((g, i) => <div key={i} style={g.style} />)}
          {todayX !== null && <div style={{ position: 'absolute', left: todayX, top: 0, width: 1, height: canvasHeight, background: '#ef4444', opacity: 0.5, zIndex: 2 }} />}
          {cells}
          {sel && (() => {
            const s = Math.min(sel.a, sel.b), e = Math.max(sel.a, sel.b) + 1
            return (
              <div style={{ position: 'absolute', left: (s - baseDay) * ppd, top: sel.row * RH + 2, width: (e - s) * ppd, height: RH - 4, borderRadius: 6, zIndex: 3, pointerEvents: 'none', background: 'repeating-linear-gradient(135deg, rgba(59,110,245,0.22) 0 4px, rgba(59,110,245,0.06) 4px 9px)', border: '1.5px solid #3b6ef5', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#1d4ed8', background: '#fff', borderRadius: 3, padding: '0 4px', whiteSpace: 'nowrap' }}>{t('{n} days', { n: e - s })}</span>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
    {popover && <TimeOffPopover key={popover.entry.id} state={popover} onClose={() => setPopover(null)} />}
    </>
  )
}
