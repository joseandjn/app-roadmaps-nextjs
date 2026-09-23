'use client'

import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { useRoadmapStore, didDrag } from '@/store/useRoadmapStore'
import { deriveScale, pack, buildHeader, isWorkingDay, fmtDate, addDays, initials, workingDaysInRange, itemEnd, dependencyIssues } from '@/lib/roadmapUtils'
import { STATUS_CONFIG, getTodayDay, TOTAL_DAYS } from '@/data/initialData'
import { roleIconDef } from '@/data/roleIcons'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useFilterContext } from '@/lib/useFilterContext'
import { useTodayDay } from '@/lib/useTodayDay'
import ContextMenu from '@/components/ContextMenu'
import { itemMatch, hidesItems, DIM_OPACITY } from '@/lib/filters'
import FilterEmptyState from '@/components/filters/FilterEmptyState'

const ROW = 32, BAR_H = 22, LP = 14
const issueBadge: React.CSSProperties = { fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 5, background: '#fdf1e3', color: '#9a5b00', border: '1px solid #f1d3a8' }
const LABEL_W = 264
const SPRINT_ROW_H = 22
const HEADER_H = 54 + SPRINT_ROW_H

export default function TimelineView() {
  const {
    pxPerDay, projects, items, deps, sprints, visible, filters, draft, settings, resources, roles,
    showDeps, _tr, filterStartDay, filterEndDay, setViewport, openItem, editProject, startDrag, addDependency,
    openContextMenu, editSprint, onNewSprint, startSprintDrag,
  } = useRoadmapStore()
  const { t } = useTranslation()
  const fctx = useFilterContext()
  const todayDay = useTodayDay()

  // Single scroll container — both axes live here
  const scrollRef = useRef<HTMLDivElement>(null)
  // The bottom-right canvas (lanes + bars) — used to translate a right-click's
  // viewport coordinates into a day/project for the context menu.
  const canvasRef = useRef<HTMLDivElement>(null)
  // Live connector line while dragging from one item's handle to another —
  // viewport coordinates (not canvas-relative), since it's rendered as a
  // position:fixed overlay outside the scrollable canvas (see the drag
  // handler below for why).
  const [connDrag, setConnDrag] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  // Hover card — shows item/project detail on hover, no click needed.
  const [hoverCard, setHoverCard] = useState<{ x: number; y: number; kind: 'item' | 'project'; id: string } | null>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current) }, [])
  const startHover = useCallback((kind: 'item' | 'project', id: string) => (e: React.MouseEvent) => {
    const x = e.clientX, y = e.clientY
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = setTimeout(() => setHoverCard({ x, y, kind, id }), 350)
  }, [])
  const moveHover = useCallback((e: React.MouseEvent) => {
    setHoverCard(h => h ? { ...h, x: e.clientX, y: e.clientY } : h)
  }, [])
  const endHover = useCallback(() => {
    if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null }
    setHoverCard(null)
  }, [])
  const si = deriveScale(pxPerDay)
  const ppd = pxPerDay

  // Filter window: clamp to data range
  const baseDay   = Math.max(0, filterStartDay ?? 0)
  const lastDay   = Math.min(TOTAL_DAYS, filterEndDay ?? TOTAL_DAYS)
  const visibleDays = Math.max(1, lastDay - baseDay)
  const totalWidth = visibleDays * ppd

  const visProjects = projects.filter(p => visible.has(p.id))
  // Items the filters keep. Dependency conflicts below still use all items,
  // so a filter never hides a clash signal on the bars that remain.
  const shown = useMemo(() => items.filter(i => itemMatch(i, fctx) !== 'hide'), [items, fctx])
  const dropEmptyLanes = hidesItems(filters)
  // Dimmed items (people filter) stay drawn and clickable, just faded.
  const dimmed = useMemo(() => new Set(shown.filter(i => itemMatch(i, fctx) === 'dim').map(i => i.id)), [shown, fctx])
  const tr = _tr ? 'left .42s cubic-bezier(.4,0,.2,1),top .42s cubic-bezier(.4,0,.2,1),width .42s cubic-bezier(.4,0,.2,1)' : 'none'

  const syncViewport = useCallback(() => {
    const el = scrollRef.current
    if (el) setViewport({ left: el.scrollLeft, width: el.clientWidth })
  }, [setViewport])

  useEffect(() => {
    syncViewport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // On initial load: scroll so Today is visible (~1/3 from the left edge)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const todayOffset = (getTodayDay() - baseDay) * ppd
    el.scrollLeft = Math.max(0, todayOffset - el.clientWidth / 3)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // On filter change: snap to the start of the visible range
  const isMountRef = useRef(true)
  useEffect(() => {
    if (isMountRef.current) { isMountRef.current = false; return }
    const el = scrollRef.current
    if (el) el.scrollLeft = 0
  }, [filterStartDay, filterEndDay])

  // Prevent pinch-zoom from propagating (allow ctrl+wheel zoom via store)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => { if (e.ctrlKey || e.metaKey) e.preventDefault() }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Start dragging a dependency connector from `fromId`'s handle. Hit-testing
  // the drop target via elementFromPoint (rather than computing canvas-relative
  // math) is what lets the live line just use raw viewport coordinates.
  const startConnect = useCallback((fromId: string) => (e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setConnDrag({ x1: e.clientX, y1: e.clientY, x2: e.clientX, y2: e.clientY })

    const move = (ev: PointerEvent) => {
      setConnDrag(d => d ? { ...d, x2: ev.clientX, y2: ev.clientY } : d)
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setConnDrag(null)
      const targetEl = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-item-id]')
      const targetId = targetEl?.dataset.itemId
      if (targetId && targetId !== fromId) addDependency(targetId, fromId)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }, [addDependency])

  // Build lanes
  let y = 0, gi = 0
  const laneLabels: React.ReactElement[] = []
  const laneBgs: React.ReactElement[] = []
  const bars: React.ReactElement[] = []
  const pos: Record<string, { x: number; w: number; y: number; right: number }> = {}
  // Per-project vertical extent within the canvas — used to resolve which
  // project's lane a right-click landed in.
  const laneRanges: { id: string; top: number; height: number }[] = []

  // Dependency clash/cycle detection — computed unconditionally (not gated
  // by `showDeps`) so bars can flag a scheduling conflict even when the
  // dependency arrows themselves aren't currently shown.
  const { cycles: depCycles, conflicted: conflictedIds } = dependencyIssues(items, deps)

  // Right-click on empty canvas: resolve the day/project under the cursor and
  // open the "create here" menu. Right-click on a bar stops propagation and
  // opens the item menu instead (see onBarContextMenu below).
  const onCanvasContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const relX = e.clientX - rect.left
    const relY = e.clientY - rect.top
    const day = Math.round(baseDay + relX / ppd)
    const lane = laneRanges.find(l => relY >= l.top && relY < l.top + l.height)
    if (!lane) return
    openContextMenu(e.clientX, e.clientY, lane.id, day, null)
  }
  const onBarContextMenu = (itemId: string, projectId: string, startDay: number) => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    openContextMenu(e.clientX, e.clientY, projectId, startDay, itemId)
  }

  for (const p of visProjects) {
    const list = shown.filter(i => i.projectId === p.id)
    if (dropEmptyLanes && !list.length) continue
    const { placed, rowCount } = pack(list, ppd)
    const h = rowCount * ROW + LP * 2
    const owner = resources.find(r => r.id === p.owner)

    laneLabels.push(
      <div
        key={p.id}
        style={{ position: 'absolute', top: y, left: 0, width: LABEL_W, height: h, display: 'flex', alignItems: 'center', gap: 9, padding: '0 16px', borderBottom: '1px solid #f1f1f1', boxSizing: 'border-box', cursor: 'pointer' }}
        onClick={() => editProject(p.id)}
        onMouseEnter={startHover('project', p.id)}
        onMouseMove={moveHover}
        onMouseLeave={endHover}
      >
        <span style={{ width: 9, height: 9, borderRadius: 3, background: p.color, flex: '0 0 auto' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#27272a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
          <div style={{ fontSize: 11, color: '#a1a1aa', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{owner?.name} · {list.length} items</div>
        </div>
      </div>
    )

    laneBgs.push(
      <div key={p.id} style={{ position: 'absolute', left: 0, top: y, width: totalWidth, height: h, background: gi % 2 ? '#fcfcfd' : '#fff' }} />
    )
    laneRanges.push({ id: p.id, top: y, height: h })

    for (const { it, row } of placed) {
      // skip items fully outside the visible window
      if (it.startDay + it.dur < baseDay || it.startDay > lastDay) continue
      const c = STATUS_CONFIG[it.status]
      const left = (it.startDay - baseDay) * ppd
      const topPx = y + LP + row * ROW
      const isM = it.type === 'milestone' || it.type === 'release'
      const sel = draft?.id === it.id
      const inConflict = conflictedIds.has(it.id)
      const fade = dimmed.has(it.id) && !sel ? DIM_OPACITY : 1

      pos[it.id] = { x: Math.max(0, left), w: isM ? 0 : Math.max(7, it.dur * ppd), y: topPx + BAR_H / 2, right: Math.max(0, left) + (isM ? 0 : Math.max(7, it.dur * ppd)) }

      if (isM) {
        bars.push(
          <div
            key={it.id}
            data-item-id={it.id}
            style={{ position: 'absolute', left: left - 7, top: topPx, height: BAR_H, display: 'flex', alignItems: 'center', gap: 6, cursor: 'grab', zIndex: sel ? 5 : 2, whiteSpace: 'nowrap', transition: tr, touchAction: 'none', opacity: fade }}
            onClick={() => { if (!didDrag()) openItem(it.id) }}
            onPointerDown={e => { e.stopPropagation(); e.preventDefault(); startDrag(it.id, 'move', e.clientX) }}
            onContextMenu={onBarContextMenu(it.id, it.projectId, it.startDay)}
            onMouseEnter={startHover('item', it.id)}
            onMouseMove={moveHover}
            onMouseLeave={endHover}
            title={inConflict ? t('Clash') : undefined}
          >
            <div style={{ position: 'relative', width: 11, height: 11, flex: '0 0 auto' }}>
              <div style={{ position: 'absolute', inset: 0, transform: 'rotate(45deg)', background: it.type === 'release' ? c.dot : '#fff', border: `2px solid ${inConflict ? '#d08a8a' : c.dot}`, borderRadius: 2, boxShadow: sel ? '0 0 0 2px #18181b' : inConflict ? '0 0 0 2px #d08a8a' : 'none' }} />
              {showDeps && (
                <div
                  onPointerDown={startConnect(it.id)}
                  title={t('Drag to create a dependency')}
                  style={{ position: 'absolute', left: 6, top: -3, width: 9, height: 9, borderRadius: '50%', background: '#fff', border: '2px solid #3b6ef5', cursor: 'crosshair', zIndex: 4, touchAction: 'none' }}
                />
              )}
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#3f3f46' }}>{it.title}</span>
          </div>
        )
      } else {
        const w = Math.max(7, it.dur * ppd)
        const showLabel = w > 34
        const isEpic = it.type === 'epic'
        const prog = isEpic && it.status === 'In Progress' && todayDay !== null ? Math.max(0, Math.min(1, (todayDay - it.startDay) / it.dur)) : null

        bars.push(
          <div
            key={it.id}
            data-item-id={it.id}
            style={{ position: 'absolute', left, top: topPx, width: w, height: BAR_H, display: 'flex', alignItems: 'center', padding: '0 8px', boxSizing: 'border-box', borderRadius: 6, background: c.bg, border: `1px solid ${inConflict ? '#d08a8a' : c.bd}`, color: c.fg, fontSize: isEpic ? 12 : 11, fontWeight: isEpic ? 600 : 500, cursor: 'grab', overflow: 'visible', whiteSpace: 'nowrap', boxShadow: sel ? '0 0 0 2px #18181b' : inConflict ? '0 0 0 1.5px #d08a8a' : 'none', zIndex: sel ? 5 : inConflict ? 2 : 1, transition: tr, touchAction: 'none', opacity: fade }}
            onClick={() => { if (!didDrag()) openItem(it.id) }}
            onPointerDown={e => { e.stopPropagation(); e.preventDefault(); startDrag(it.id, 'move', e.clientX) }}
            onContextMenu={onBarContextMenu(it.id, it.projectId, it.startDay)}
            onMouseEnter={startHover('item', it.id)}
            onMouseMove={moveHover}
            onMouseLeave={endHover}
            title={inConflict ? t('Clash') : undefined}
          >
            {prog !== null && (
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(prog ?? 0) * 100}%`, background: 'rgba(59,110,245,0.16)', borderRadius: 'inherit', overflow: 'hidden' }} />
            )}
            {showLabel && <span style={{ position: 'relative', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{it.title}</span>}
            {it.requiredRoles && it.requiredRoles.length > 0 && (
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 2, flex: '0 0 auto' }}>
                {it.requiredRoles.slice(0, 3).map(roleName => {
                  const { Icon } = roleIconDef(roles.find(r => r.name === roleName)?.icon)
                  return <Icon key={roleName} size={10} />
                })}
                {it.requiredRoles.length > 3 && <span style={{ fontSize: 9, fontWeight: 700 }}>+{it.requiredRoles.length - 3}</span>}
              </div>
            )}
            <div
              style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 7, cursor: 'ew-resize', zIndex: 3, touchAction: 'none' }}
              onPointerDown={e => { e.stopPropagation(); e.preventDefault(); startDrag(it.id, 'resize', e.clientX) }}
            />
            {showDeps && (
              <div
                onPointerDown={startConnect(it.id)}
                title={t('Drag to create a dependency')}
                style={{ position: 'absolute', right: -6, top: '50%', transform: 'translateY(-50%)', width: 10, height: 10, borderRadius: '50%', background: '#fff', border: '2px solid #3b6ef5', cursor: 'crosshair', zIndex: 4, touchAction: 'none' }}
              />
            )}
          </div>
        )
      }
    }

    y += h
    gi++
  }

  const canvasHeight = Math.max(y, 240)
  const { bands, ticks, gridLines } = buildHeader(si, ppd, totalWidth, canvasHeight, baseDay, lastDay)
  const todayX = todayDay === null ? null : (todayDay - baseDay) * ppd

  // Sprint row — irregular, user-defined boundaries (not derived from the calendar),
  // so it's built here rather than folded into buildHeader (shared with other views).
  const sprintSegs = sprints
    .map(sp => ({ sp, x: (sp.startDay - baseDay) * ppd, right: (sp.startDay + sp.dur - baseDay) * ppd }))
    .filter(s => s.right > 0 && s.x < totalWidth)
  const sprintBoundaries = sprints
    .map(sp => (sp.startDay - baseDay) * ppd)
    .filter(x => x >= 0 && x <= totalWidth)
  const lastSprintEnd = sprints.length ? Math.max(...sprints.map(s => s.startDay + s.dur)) : 0
  const addSprintX = (lastSprintEnd - baseDay) * ppd

  // Non-working day shading (weekends/holidays) — purely visual, doesn't
  // change bar/sprint positioning or duration math.
  const nonWorkingX: number[] = []
  if (!settings.countWeekends || settings.holidays.length > 0) {
    for (let d = baseDay; d < lastDay; d++) {
      if (!isWorkingDay(d, settings)) nonWorkingX.push((d - baseDay) * ppd)
    }
  }

  // Hover card content — built from live item/project data, positioned by hoverCard.x/y below.
  let hoverContent: React.ReactElement | null = null
  if (hoverCard?.kind === 'item') {
    const it = items.find(i => i.id === hoverCard.id)
    if (it) {
      const pr = projects.find(p => p.id === it.projectId)
      const c = STATUS_CONFIG[it.status]
      const isInstant = it.type === 'milestone' || it.type === 'release'
      const workDays = isInstant ? 0 : workingDaysInRange(it.startDay, it.dur, settings)
      const totalHours = Math.round(it.assignments.reduce((s, a) => s + workDays * settings.workHoursPerDay * a.pct / 100, 0))
      hoverContent = (
        <>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#18181b', marginBottom: 6 }}>{it.title}</div>
          {pr && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ width: 7, height: 7, borderRadius: 2, background: pr.color, flex: '0 0 auto' }} />
              <span style={{ fontSize: 11, color: '#71717a' }}>{pr.name}</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 5, background: c.bg, color: c.fg, border: `1px solid ${c.bd}` }}>{t(it.status)}</span>
            <span style={{ fontSize: 11, color: '#a1a1aa' }}>{t(it.type.charAt(0).toUpperCase() + it.type.slice(1))}</span>
            {conflictedIds.has(it.id) && (
              <span style={issueBadge}>{t('Clash')}</span>
            )}
            {fctx.issues.get(it.id)?.includes('overload') && <span style={issueBadge}>{t('Overloaded')}</span>}
            {fctx.issues.get(it.id)?.includes('role') && <span style={issueBadge}>{t('Wrong role')}</span>}
          </div>
          {it.requiredRoles && it.requiredRoles.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
              {it.requiredRoles.map(roleName => {
                const { Icon } = roleIconDef(roles.find(r => r.name === roleName)?.icon)
                return (
                  <span key={roleName} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 999, background: '#f4f4f5', color: '#52525b' }}>
                    <Icon size={9} />
                    {t(roleName)}
                  </span>
                )
              })}
            </div>
          )}
          <div style={{ fontSize: 11, color: '#52525b' }}>
            {isInstant ? fmtDate(addDays(it.startDay)) : `${fmtDate(addDays(it.startDay))} – ${fmtDate(addDays(it.startDay + it.dur))}`}
          </div>
          {!isInstant && (
            <div style={{ fontSize: 11, color: '#a1a1aa', marginTop: 2 }}>
              {t('{n} working days', { n: workDays })}{it.assignments.length > 0 && ` · ${totalHours}h`}
            </div>
          )}
          {it.assignments.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8, paddingTop: 8, borderTop: '1px solid #f1f1f1' }}>
              {it.assignments.map(a => {
                const r = resources.find(rr => rr.id === a.r)
                if (!r) return null
                const hrs = Math.round(workDays * settings.workHoursPerDay * a.pct / 100)
                return (
                  <div key={a.r} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#52525b' }}>
                    <span style={{ width: 18, height: 18, borderRadius: 5, background: '#ececef', color: '#52525b', fontSize: 9, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>{initials(r.name)}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                    <span style={{ color: '#a1a1aa', flex: '0 0 auto' }}>{a.pct}%{!isInstant ? ` · ${hrs}h` : ''}</span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )
    }
  } else if (hoverCard?.kind === 'project') {
    const p = projects.find(pr => pr.id === hoverCard.id)
    if (p) {
      const list = items.filter(i => i.projectId === p.id)
      const owner = resources.find(r => r.id === p.owner)
      const range = list.length ? { a: Math.min(...list.map(i => i.startDay)), b: Math.max(...list.map(i => i.startDay + i.dur)) } : null
      const sc = STATUS_CONFIG[p.status]
      hoverContent = (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, flex: '0 0 auto' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#18181b' }}>{p.name}</span>
          </div>
          {p.desc && <div style={{ fontSize: 11, color: '#71717a', marginBottom: 8, lineHeight: 1.4 }}>{p.desc}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 5, background: sc.bg, color: sc.fg, border: `1px solid ${sc.bd}` }}>{t(p.status)}</span>
            <span style={{ fontSize: 11, color: '#a1a1aa' }}>{t(p.category)}</span>
          </div>
          {owner && <div style={{ fontSize: 11, color: '#52525b', marginBottom: 4 }}>{t('Owner')}: {owner.name}</div>}
          <div style={{ fontSize: 11, color: '#a1a1aa' }}>
            {t('{n} items', { n: list.length })}
            {range && ` · ${fmtDate(addDays(range.a))} – ${fmtDate(addDays(range.b))}`}
          </div>
        </>
      )
    }
  }

  // Dependency lines
  const depLines: React.ReactElement[] = []
  if (showDeps) {
    for (const e of deps) {
      const a = pos[e.to], b = pos[e.from]
      if (!a || !b) continue
      const itTo = items.find(i => i.id === e.to)!
      const itFrom = items.find(i => i.id === e.from)!
      const bad = itemEnd(itTo) > itFrom.startDay || depCycles.has(`${e.from}>${e.to}`)
      const x1 = a.right, y1 = a.y, x2 = b.x, y2 = b.y
      const mx = (x1 + x2) / 2
      const d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2 - 2} ${y2}`
      depLines.push(
        <path key={e.id} d={d} fill="none" stroke={bad ? '#d08a8a' : '#b9c2cf'} strokeWidth={bad ? 1.6 : 1.3} strokeDasharray={bad ? '4 3' : '0'} markerEnd={bad ? 'url(#ahc)' : 'url(#ah)'} />
      )
    }
  }

  return (
    <>
    {dropEmptyLanes && laneLabels.length === 0 && <FilterEmptyState />}
    {/* Single scroll container — one ref handles both X and Y scroll */}
    <div
      ref={scrollRef}
      className="flex-1 min-h-0 overflow-auto"
      onScroll={syncViewport}
      style={{ position: 'relative' }}
    >
      {/*
        The inner grid is wider than the viewport (totalWidth + LABEL_W) and taller
        than the viewport (canvasHeight + HEADER_H). Scrolling this single container
        moves everything together. Sticky CSS pins the header row and left column.
      */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `${LABEL_W}px ${totalWidth}px`,
        gridTemplateRows: `${HEADER_H}px ${canvasHeight}px`,
        minWidth: LABEL_W + totalWidth,
      }}>

        {/* ── Top-left corner: "PROJECT" label — sticky in both axes ── */}
        <div style={{
          position: 'sticky', top: 0, left: 0, zIndex: 30,
          background: '#fff', borderBottom: '1px solid #ececec', borderRight: '1px solid #ececec',
          display: 'flex', alignItems: 'center', padding: '0 16px',
        }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#a1a1aa' }}>{t('Project')}</span>
        </div>

        {/* ── Top-right: timeline header (date bands + ticks) — sticky top only ── */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 20,
          background: '#fff', borderBottom: '1px solid #ececec',
        }}>
          <div style={{ position: 'relative', width: totalWidth, height: HEADER_H, overflow: 'hidden' }}>
            {/* Sprint row */}
            <div style={{ position: 'absolute', left: 0, top: 0, width: totalWidth, height: SPRINT_ROW_H, borderBottom: '1px solid #ececec' }}>
              {sprintSegs.map(({ sp, x, right }) => {
                const l = Math.max(0, x), w = Math.min(right, totalWidth) - l
                if (w <= 0) return null
                return (
                  <div
                    key={sp.id}
                    onClick={() => { if (!didDrag()) editSprint(sp.id) }}
                    onPointerDown={e => { e.stopPropagation(); e.preventDefault(); startSprintDrag(sp.id, 'move', e.clientX) }}
                    style={{ position: 'absolute', left: l, top: 0, width: w, height: SPRINT_ROW_H, display: 'flex', alignItems: 'center', padding: '0 8px', boxSizing: 'border-box', borderRight: '1px solid #e4e4e7', background: '#fafafa', fontSize: 10, fontWeight: 600, color: '#71717a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'grab', fontFamily: 'ui-monospace,Menlo,monospace', touchAction: 'none' }}
                  >
                    {sp.name}
                    <div
                      onPointerDown={e => { e.stopPropagation(); e.preventDefault(); startSprintDrag(sp.id, 'resize', e.clientX) }}
                      style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 6, cursor: 'ew-resize', touchAction: 'none' }}
                    />
                  </div>
                )
              })}
              {addSprintX >= 0 && addSprintX <= totalWidth - 20 && (
                <button
                  onClick={onNewSprint}
                  title={t('Add sprint')}
                  style={{ position: 'absolute', left: addSprintX + 4, top: 2, width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #ececec', background: '#fff', borderRadius: 5, color: '#a1a1aa', fontSize: 13, lineHeight: 1, cursor: 'pointer', padding: 0 }}
                >
                  +
                </button>
              )}
            </div>
            {/* Calendar bands/ticks — shifted below the sprint row */}
            <div style={{ position: 'absolute', left: 0, top: SPRINT_ROW_H, width: totalWidth, height: HEADER_H - SPRINT_ROW_H }}>
              {bands.map((b, i) => <div key={i} style={b.style}>{b.label}</div>)}
              {ticks.map((t, i) => <div key={i} style={t.style}>{t.label}</div>)}
              {/* Today chip — only when TODAY falls within the visible range */}
              {todayX !== null && todayX >= 0 && todayX <= totalWidth && (
                <div style={{ position: 'absolute', left: todayX, top: 28, transform: 'translateX(-50%)', background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 5, whiteSpace: 'nowrap', zIndex: 5, fontFamily: 'ui-monospace,Menlo,monospace' }}>
                  {t('Today')}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Bottom-left: lane labels — sticky left only ── */}
        <div style={{
          position: 'sticky', left: 0, zIndex: 10,
          background: '#fcfcfd', borderRight: '1px solid #ececec',
        }}>
          <div style={{ position: 'relative', height: canvasHeight }}>
            {laneLabels}
          </div>
        </div>

        {/* ── Bottom-right: canvas ── */}
        <div
          ref={canvasRef}
          onContextMenu={onCanvasContextMenu}
          style={{ position: 'relative', width: totalWidth, height: canvasHeight, overflow: 'hidden' }}
        >
          {laneBgs}
          {/* Non-working day shading (weekends/holidays) */}
          {nonWorkingX.map((x, i) => (
            <div key={i} style={{ position: 'absolute', left: x, top: 0, width: ppd, height: canvasHeight, background: 'rgba(24,24,27,0.035)' }} />
          ))}
          {gridLines.map((g, i) => <div key={i} style={g.style} />)}
          {/* Sprint boundary lines */}
          {sprintBoundaries.map((x, i) => (
            <div key={i} style={{ position: 'absolute', left: x, top: 0, width: 1, height: canvasHeight, background: '#e4e4e7', zIndex: 1 }} />
          ))}
          {/* Today line */}
          {todayX !== null && <div style={{ position: 'absolute', left: todayX, top: 0, width: 1, height: canvasHeight, background: '#ef4444', opacity: 0.5, zIndex: 2 }} />}
          {bars}
          {showDeps && (
            <svg style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', zIndex: 1, overflow: 'visible' }} width={totalWidth} height={canvasHeight}>
              <defs>
                <marker id="ah" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#b9c2cf" />
                </marker>
                <marker id="ahc" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#d08a8a" />
                </marker>
              </defs>
              {depLines}
            </svg>
          )}
        </div>
      </div>
    </div>

    {/* Live connector line while dragging from an item's handle — a
        viewport-fixed overlay so it can be drawn in raw clientX/clientY
        coordinates without converting through the scrollable canvas's
        own coordinate space. */}
    {connDrag && (
      <svg style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 100 }}>
        <defs>
          <marker id="ah-drag" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#3b6ef5" />
          </marker>
        </defs>
        <line x1={connDrag.x1} y1={connDrag.y1} x2={connDrag.x2} y2={connDrag.y2} stroke="#3b6ef5" strokeWidth={1.6} strokeDasharray="4 3" markerEnd="url(#ah-drag)" />
      </svg>
    )}

    {/* Hover card — item/project detail on hover, no click needed */}
    {hoverCard && hoverContent && (
      <div
        style={{
          position: 'fixed',
          left: Math.min(hoverCard.x + 14, window.innerWidth - 280),
          top: Math.min(hoverCard.y + 14, window.innerHeight - 220),
          width: 260,
          background: '#fff',
          border: '1px solid #ececec',
          borderRadius: 12,
          boxShadow: '0 8px 28px rgba(0,0,0,0.12)',
          padding: 12,
          zIndex: 200,
          pointerEvents: 'none',
        }}
      >
        {hoverContent}
      </div>
    )}

    <ContextMenu />
    </>
  )
}
