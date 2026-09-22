'use client'

import React, { useRef, useCallback, useEffect, useMemo } from 'react'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import { deriveScale, buckets, buildHeader, initials, allocColor, utilizationPct } from '@/lib/roadmapUtils'
import { getTodayDay, TOTAL_DAYS } from '@/data/initialData'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useTodayDay } from '@/lib/useTodayDay'
import { itemsForMetrics, colorLoad } from '@/lib/filters'

const RH = 46
const LABEL_W = 264
const HEADER_H = 54

export default function ResourcesView() {
  const { pxPerDay, resources, items, projects, filterStartDay, filterEndDay, filters, visible, openCell, setViewport } = useRoadmapStore()
  const { t } = useTranslation()
  const todayDay = useTodayDay()
  const scrollRef = useRef<HTMLDivElement>(null)
  const si = deriveScale(pxPerDay)
  const ppd = pxPerDay
  const baseDay   = Math.max(0, filterStartDay ?? 0)
  const lastDay   = Math.min(TOTAL_DAYS, filterEndDay ?? TOTAL_DAYS)
  const visibleDays = Math.max(1, lastDay - baseDay)
  const totalWidth = visibleDays * ppd
  const counted = useMemo(() => new Set(itemsForMetrics(items, { filters, visible }).map(i => i.id)), [items, filters, visible])

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
  const { bands, gridLines } = buildHeader(si, ppd, totalWidth, resources.length * RH, baseDay, lastDay)
  const todayX = todayDay === null ? null : (todayDay - baseDay) * ppd

  const rowLabels: React.ReactElement[] = []
  const cells: React.ReactElement[] = []

  let y = 0
  for (let ri = 0; ri < resources.length; ri++) {
    const r = resources[ri]

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
      for (const it of items) {
        if (it.dur <= 0) continue
        if (it.startDay >= absE || it.startDay + it.dur <= absS) continue
        for (const as of it.assignments) {
          if (as.r !== r.id) continue
          full += as.pct
          if (counted.has(it.id)) { total += as.pct; pAgg[it.projectId] = (pAgg[it.projectId] ?? 0) + as.pct }
        }
      }

      const col = allocColor(utilizationPct(colorLoad(total, full, r), r))
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
          title={outside > 0 ? t('Total load {full}% ({n}% outside the filters)', { full, n: outside }) : undefined}
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

    y += RH
  }

  const canvasHeight = Math.max(y, 240)

  return (
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
        <div style={{ position: 'relative', width: totalWidth, height: canvasHeight, overflow: 'hidden' }}>
          {resources.map((r, i) => (
            <div key={r.id} style={{ position: 'absolute', left: 0, top: i * RH, width: totalWidth, height: RH, background: i % 2 ? '#fcfcfd' : '#fff', borderBottom: '1px solid #f4f4f5' }} />
          ))}
          {gridLines.map((g, i) => <div key={i} style={g.style} />)}
          {todayX !== null && <div style={{ position: 'absolute', left: todayX, top: 0, width: 1, height: canvasHeight, background: '#ef4444', opacity: 0.5, zIndex: 2 }} />}
          {cells}
        </div>
      </div>
    </div>
  )
}
