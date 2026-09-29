'use client'

import React, { useRef, useCallback, useEffect, useMemo } from 'react'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import { deriveScale, pack, buildHeader } from '@/lib/roadmapUtils'
import { STATUS_CONFIG, getTodayDay } from '@/data/initialData'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useFilterContext } from '@/lib/useFilterContext'
import { useTodayDay } from '@/lib/useTodayDay'
import { usePlanEnd } from '@/lib/usePlanEnd'
import { itemMatch, hidesItems, DIM_OPACITY } from '@/lib/filters'
import FilterEmptyState from '@/components/filters/FilterEmptyState'
const ROW = 32, BAR_H = 22, RH = 58
const LABEL_W = 264
const HEADER_H = 54

export default function CrossView() {
  const { pxPerDay, projects, items, visible, filters, expanded, _tr, filterStartDay, filterEndDay, setViewport, openItem, toggleExpand } = useRoadmapStore()
  const { t } = useTranslation()
  const fctx = useFilterContext()
  const todayDay = useTodayDay()
  const scrollRef = useRef<HTMLDivElement>(null)
  const si = deriveScale(pxPerDay)
  const ppd = pxPerDay
  const baseDay  = Math.max(0, filterStartDay ?? 0)
  const lastDay  = usePlanEnd()
  const visibleDays = Math.max(1, lastDay - baseDay)
  const totalWidth = visibleDays * ppd
  const tr = _tr ? 'left .42s cubic-bezier(.4,0,.2,1),top .42s cubic-bezier(.4,0,.2,1),width .42s cubic-bezier(.4,0,.2,1)' : 'none'

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

  const visProjects = projects.filter(p => visible.has(p.id))
  // Envelopes, ticks and expanded bars all come from the items the filters keep.
  const shown = useMemo(() => items.filter(i => itemMatch(i, fctx) !== 'hide'), [items, fctx])
  const dimmed = useMemo(() => new Set(shown.filter(i => itemMatch(i, fctx) === 'dim').map(i => i.id)), [shown, fctx])

  let y = 0, gi = 0
  const laneLabels: React.ReactElement[] = []
  const bars: React.ReactElement[] = []
  const laneBgs: React.ReactElement[] = []
  const ranges: { p: typeof projects[0]; r: { a: number; b: number } }[] = []

  for (const p of visProjects) {
    const pItems = shown.filter(i => i.projectId === p.id)
    if (!pItems.length) continue
    let a = 1e9, b = -1e9
    for (const i of pItems) { a = Math.min(a, i.startDay); b = Math.max(b, i.startDay + i.dur) }
    ranges.push({ p, r: { a, b } })
  }

  for (const { p, r } of ranges) {
    const exp = expanded.has(p.id)
    const pItems = shown.filter(i => i.projectId === p.id)
    let packed: ReturnType<typeof pack> | null = null
    let laneH = RH
    if (exp) { packed = pack(pItems, ppd); laneH = RH + packed.rowCount * ROW + 10 }
    const top = y + 12

    laneLabels.push(
      <div key={p.id} style={{ position: 'absolute', top: y, left: 0, width: 264, height: laneH, display: 'flex', alignItems: 'flex-start', gap: 8, padding: '19px 16px 0', borderBottom: '1px solid #f1f1f1', boxSizing: 'border-box', cursor: 'pointer' }}
        onClick={() => toggleExpand(p.id)}>
        <span style={{ fontSize: 10, color: '#a1a1aa', flex: '0 0 auto', width: 12 }}>{exp ? '▾' : '▸'}</span>
        <span style={{ width: 9, height: 9, borderRadius: 3, background: p.color, flex: '0 0 auto', marginTop: 2 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#27272a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
          <div style={{ fontSize: 11, color: '#a1a1aa', marginTop: 1 }}>{t(p.category)} · {t('{n} items', { n: pItems.length })}</div>
        </div>
      </div>
    )

    laneBgs.push(<div key={p.id} style={{ position: 'absolute', left: 0, top: y, width: totalWidth, height: laneH, background: gi % 2 ? '#fcfcfd' : '#fff' }} />)

    // Project bar
    bars.push(
      <div key={`${p.id}-bar`} style={{ position: 'absolute', left: (r.a - baseDay) * ppd, top, width: Math.max(10, (r.b - r.a) * ppd), height: 30, display: 'flex', alignItems: 'center', padding: '0 10px', boxSizing: 'border-box', borderRadius: 8, background: p.color + '1a', border: `1px solid ${p.color}55`, color: p.color, fontSize: 12, fontWeight: 600, cursor: 'pointer', overflow: 'hidden', whiteSpace: 'nowrap', transition: tr }}
        onClick={() => toggleExpand(p.id)}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name.split(' — ')[0]}</span>
      </div>
    )

    if (!exp) {
      for (const it of pItems) {
        if (it.startDay + it.dur < baseDay || it.startDay > lastDay) continue
        const c = STATUS_CONFIG[it.status]
        bars.push(
          <div key={`${it.id}-tick`} data-item-id={it.id} style={{ position: 'absolute', left: (it.startDay - baseDay) * ppd, top: top + 34, width: Math.max(3, it.dur * ppd), height: 8, borderRadius: 3, background: c.dot, opacity: dimmed.has(it.id) ? 0.5 * DIM_OPACITY : 0.5, cursor: 'pointer' }}
            onClick={() => toggleExpand(p.id)} />
        )
      }
    } else if (packed) {
      // Double click opens an item, as in the Timeline (a single click there
      // selects; this view has no selection, so it does nothing here).
      for (const { it, row } of packed.placed) {
        if (it.startDay + it.dur < baseDay || it.startDay > lastDay) continue
        const c = STATUS_CONFIG[it.status]
        const left = (it.startDay - baseDay) * ppd
        const topPx = y + RH + row * ROW
        const isM = it.type === 'milestone' || it.type === 'release'
        if (isM) {
          bars.push(
            <div key={`${it.id}-x`} data-item-id={it.id} style={{ position: 'absolute', left: left - 7, top: topPx, height: BAR_H, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap', opacity: dimmed.has(it.id) ? DIM_OPACITY : 1 }}
              title={t('Double-click to edit')}
              onDoubleClick={() => openItem(it.id)}>
              <div style={{ width: 11, height: 11, transform: 'rotate(45deg)', background: it.type === 'release' ? c.dot : '#fff', border: `2px solid ${c.dot}`, borderRadius: 2, flex: '0 0 auto' }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: '#3f3f46' }}>{it.title}</span>
            </div>
          )
        } else {
          const w = Math.max(7, it.dur * ppd)
          bars.push(
            <div key={`${it.id}-x`} data-item-id={it.id} style={{ position: 'absolute', left, top: topPx, width: w, height: BAR_H, display: 'flex', alignItems: 'center', padding: '0 8px', boxSizing: 'border-box', borderRadius: 6, background: c.bg, border: `1px solid ${c.bd}`, color: c.fg, fontSize: it.type === 'epic' ? 12 : 11, fontWeight: it.type === 'epic' ? 600 : 500, cursor: 'pointer', overflow: 'hidden', whiteSpace: 'nowrap', opacity: dimmed.has(it.id) ? DIM_OPACITY : 1 }}
              title={t('Double-click to edit')}
              onDoubleClick={() => openItem(it.id)}>
              {w > 34 && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{it.title}</span>}
            </div>
          )
        }
      }
    }

    y += laneH
    gi++
  }

  const canvasHeight = Math.max(y, 240)
  const { gridLines } = buildHeader(si, ppd, totalWidth, canvasHeight, baseDay, lastDay)
  const todayX = todayDay === null ? null : (todayDay - baseDay) * ppd

  // Overlap bands
  const overlapBands: React.ReactElement[] = []
  const evs: [number, number][] = []
  for (const { r } of ranges) { evs.push([r.a, 1], [r.b, -1]) }
  evs.sort((a, b) => a[0] - b[0] || b[1] - a[1])
  let cnt = 0, segStart: number | null = null
  for (const [x, delta] of evs) {
    const prev = cnt; cnt += delta
    if (prev < 2 && cnt >= 2) segStart = x
    if (prev >= 2 && cnt < 2 && segStart !== null) {
      overlapBands.push(
        <div key={`ovl-${segStart}`} style={{ position: 'absolute', left: (segStart - baseDay) * ppd, top: 0, width: (x - segStart) * ppd, height: y, background: 'repeating-linear-gradient(135deg,rgba(99,102,241,0.06),rgba(99,102,241,0.06) 7px,rgba(99,102,241,0) 7px,rgba(99,102,241,0) 14px)', borderLeft: '1px solid rgba(99,102,241,0.18)', borderRight: '1px solid rgba(99,102,241,0.18)' }} />
      )
      segStart = null
    }
  }

  const { bands, ticks } = buildHeader(si, ppd, totalWidth, canvasHeight, baseDay, lastDay)

  return (
    <>
    {hidesItems(filters) && ranges.length === 0 && <FilterEmptyState />}
    <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto" onScroll={syncViewport}>
      <div style={{ display: 'grid', gridTemplateColumns: `${LABEL_W}px ${totalWidth}px`, gridTemplateRows: `${HEADER_H}px ${canvasHeight}px`, minWidth: LABEL_W + totalWidth }}>
        {/* Top-left corner */}
        <div style={{ position: 'sticky', top: 0, left: 0, zIndex: 30, background: '#fff', borderBottom: '1px solid #ececec', borderRight: '1px solid #ececec', display: 'flex', alignItems: 'center', padding: '0 16px' }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#a1a1aa' }}>{t('Project')}</span>
        </div>
        {/* Top-right: header */}
        <div style={{ position: 'sticky', top: 0, zIndex: 20, background: '#fff', borderBottom: '1px solid #ececec' }}>
          <div style={{ position: 'relative', width: totalWidth, height: HEADER_H, overflow: 'hidden' }}>
            {bands.map((b, i) => <div key={i} style={b.style}>{b.label}</div>)}
            {ticks.map((t, i) => <div key={i} style={t.style}>{t.label}</div>)}
            {todayX !== null && todayX >= 0 && todayX <= totalWidth && (
              <div style={{ position: 'absolute', left: todayX, top: 28, transform: 'translateX(-50%)', background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 5, whiteSpace: 'nowrap', zIndex: 5, fontFamily: 'ui-monospace,Menlo,monospace' }}>{t('Today')}</div>
            )}
          </div>
        </div>
        {/* Bottom-left: lane labels */}
        <div style={{ position: 'sticky', left: 0, zIndex: 10, background: '#fcfcfd', borderRight: '1px solid #ececec' }}>
          <div style={{ position: 'relative', height: canvasHeight }}>{laneLabels}</div>
        </div>
        {/* Bottom-right: canvas */}
        <div style={{ position: 'relative', width: totalWidth, height: canvasHeight, overflow: 'hidden' }}>
          {laneBgs}
          {gridLines.map((g, i) => <div key={i} style={g.style} />)}
          {todayX !== null && <div style={{ position: 'absolute', left: todayX, top: 0, width: 1, height: canvasHeight, background: '#ef4444', opacity: 0.5, zIndex: 2 }} />}
          {overlapBands}
          {bars}
        </div>
      </div>
    </div>
    </>
  )
}
