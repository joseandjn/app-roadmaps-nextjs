'use client'

import { create } from 'zustand'
import type { RoadmapState, Item, Project, Resource, Settings, Draft, ViewKey, ScenarioData, ScenarioMeta } from '@/types'
import {
  INITIAL_PROJECTS, INITIAL_ITEMS, INITIAL_RESOURCES, INITIAL_DEPS, INITIAL_SPRINTS, INITIAL_ROLES, DEFAULT_SETTINGS,
  getTodayDay, SCALE_PRESETS, PROJECT_COLORS, DEFAULT_PROJECT_TASKS,
} from '@/data/initialData'
import { deriveScale, dateStr, offFromStr, resPeak, pack, itemEnd, resourceCapacity, isOverloaded } from '@/lib/roadmapUtils'
import { t } from '@/lib/i18n/translations'

type Store = RoadmapState & {
  // persistence
  hydrateScenario: (data: ScenarioData) => void
  hydrateView: (v: { filterStartDay: number | null; filterEndDay: number | null }) => void
  setScenarioList: (scenarios: ScenarioMeta[], officialId: string) => void
  setActiveScenarioId: (id: string) => void
  onNewScenario: () => void
  patchScenarioForm: (p: Partial<{ name: string; note: string }>) => void
  onScenarioFormCancel: () => void
  toggleHistory: () => void
  toggleAnalysis: () => void
  onNewCheckpoint: () => void
  patchCheckpointForm: (p: Partial<{ name: string; note: string }>) => void
  onCheckpointFormCancel: () => void
  // view
  setView: (v: ViewKey) => void
  setScale: (i: number) => void
  zoom: (f: number) => void
  toggleRail: () => void
  toggleProject: (id: string) => void
  toggleExpand: (id: string) => void
  setViewport: (v: { left: number; width: number }) => void
  showToast: (text: string) => void
  clearToast: () => void
  // items
  openItem: (id: string) => void
  newItem: (pid: string) => void
  newItemAt: (pid: string, day: number, type?: Item['type']) => void
  duplicateItem: (id: string) => void
  deleteItemById: (id: string) => void
  openContextMenu: (x: number, y: number, projectId: string, day: number, itemId?: string | null) => void
  closeContextMenu: () => void
  clearPanel: () => void
  patchDraft: (p: Partial<Draft>) => void
  onDraftTitle: (v: string) => void
  onDraftStatus: (v: string) => void
  onDraftType: (v: string) => void
  onDraftRequiredRole: (v: string) => void
  onDraftStart: (v: string) => void
  onDraftEnd: (v: string) => void
  onAddAssignee: (id: string) => void
  setAssignPct: (rid: string, v: number) => void
  removeAssign: (rid: string) => void
  onAddDep: (id: string) => void
  removeDep: (id: string) => void
  onSaveItem: () => void
  commitItem: () => void
  onDeleteItem: () => void
  startDrag: (id: string, mode: 'move' | 'resize', clientX: number) => () => void
  // projects
  onNewProject: () => void
  editProject: (id: string) => void
  patchPF: (p: Partial<NonNullable<RoadmapState['pform']>>) => void
  onPSave: () => void
  onPCancel: () => void
  onPDelete: () => void
  // resources
  openRes: (rid: string) => void
  openCell: (rid: string, bIdx: number, bucket: { s: number; d: number; label: string }) => void
  onNewResource: () => void
  editResource: (id: string) => void
  patchRF: (p: Partial<NonNullable<RoadmapState['rform']>>) => void
  onRSave: () => void
  onRCancel: () => void
  onRDelete: () => void
  // sprints
  onNewSprint: () => void
  editSprint: (id: string) => void
  patchSF: (p: Partial<NonNullable<RoadmapState['sform']>>) => void
  onSFSave: () => void
  onSFCancel: () => void
  onSFDelete: () => void
  startSprintDrag: (id: string, mode: 'move' | 'resize', clientX: number) => () => void
  // history
  undo: () => void
  redo: () => void
  // settings
  patchSettings: (p: Partial<Settings>) => void
  addHoliday: (date: string) => void
  removeHoliday: (date: string) => void
  // roles catalog (Settings → Roles)
  addRole: (name: string, icon: string) => void
  removeRole: (name: string) => void
  renameRole: (oldName: string, newName: string) => void
  setRoleIcon: (name: string, icon: string) => void
  toggleDeps: () => void
  addDependency: (fromId: string, toId: string) => void
  setFilter: (startDay: number | null, endDay: number | null) => void
  clearFilter: () => void
  // voice agent — direct mutations from structured LLM output, bypassing pform/rform staging
  agentCreateResource: (data: { name: string; role: string; cost: number; costUnit?: 'month' | 'hour' }) => void
  agentUpdateResource: (id: string, patch: Partial<{ name: string; role: string; cost: number; costUnit: 'month' | 'hour' }>) => void
  agentCreateProject: (data: { name: string; desc?: string; owner: string; category?: string; status?: Project['status'] }) => void
  agentUpdateProject: (id: string, patch: Partial<{ name: string; desc: string; owner: string; category: string; status: Project['status'] }>) => void
  agentCreateItem: (data: { projectId: string; title: string; type: Item['type']; startDay: number; dur: number; status?: Item['status']; requiredRole?: string }) => void
  agentUpdateItem: (id: string, patch: Partial<{ title: string; type: Item['type']; status: Item['status']; startDay: number; dur: number; requiredRole: string | undefined }>) => void
}

function projRange(items: Item[], pid: string) {
  const its = items.filter(i => i.projectId === pid)
  if (!its.length) return null
  let a = 1e9, b = -1e9
  for (const i of its) { a = Math.min(a, i.startDay); b = Math.max(b, i.startDay + i.dur) }
  return { a, b }
}

function computeImpact(draft: Draft, orig: Item | null, items: Item[], deps: RoadmapState['deps'], people: Resource[]) {
  const simItems = orig ? items.map(i => i.id === draft.id ? draft : i) : [...items, draft]
  const depEdges = deps.filter(e => e.to === draft.id)
  const depResults = depEdges.map(e => {
    const dep = items.find(i => i.id === e.from)!
    return { item: dep, clash: itemEnd(draft) > dep.startDay }
  })
  const rset = new Set<string>()
  for (const a of draft.assignments) rset.add(a.r)
  if (orig) for (const a of orig.assignments) rset.add(a.r)
  const resources = [...rset].map(rid => {
    const before = resPeak(rid, items)
    const after = resPeak(rid, simItems)
    const person = people.find(p => p.id === rid)
    // Over means above the person's own availability, not a flat 100%.
    return { rid, before, after, capacity: person ? resourceCapacity(person) : 100, over: person ? isOverloaded(after, person) : after > 100 }
  }).filter(r => r.before !== r.after || r.over)
  const pset = new Set<string>([draft.projectId])
  for (const d of depResults) pset.add(d.item.projectId)
  return { deps: depResults, resources, projects: [...pset] }
}

// Undo/redo history over the persisted planning data only — UI state (panels,
// zoom, filters) is never recorded. Snapshots are reference-only (state is
// immutable), so keeping 100 of them is cheap.
type Snapshot = Pick<RoadmapState, 'projects' | 'items' | 'resources' | 'deps' | 'sprints' | 'settings' | 'roles'>
const HISTORY_LIMIT = 100
const past: Snapshot[] = []
const future: Snapshot[] = []
let historyPaused = false
let gestureStart: Snapshot | null = null

const takeSnapshot = (s: Snapshot): Snapshot => ({
  projects: s.projects, items: s.items, resources: s.resources, deps: s.deps, sprints: s.sprints, settings: s.settings, roles: s.roles,
})
const sameRefs = (a: Snapshot, b: Snapshot) =>
  a.projects === b.projects && a.items === b.items && a.resources === b.resources &&
  a.deps === b.deps && a.sprints === b.sprints && a.settings === b.settings && a.roles === b.roles

function recordPast(snap: Snapshot) {
  past.push(snap)
  if (past.length > HISTORY_LIMIT) past.shift()
  future.length = 0
}

// A drag fires a store update per pointermove; the whole gesture must become
// one undo step, so the subscriber below stays quiet until it ends.
function beginGesture(snap: Snapshot) { gestureStart = snap; dragMoved = false }

// A drag ends in a click on the same element; bars/sprints check this so
// dropping one doesn't also open its editor (whose draft would be stale).
let dragMoved = false
export const didDrag = () => dragMoved
function endGesture(current: Snapshot) {
  const start = gestureStart
  gestureStart = null
  if (!start || JSON.stringify(start) === JSON.stringify(current)) return
  recordPast(start)
}

function resetHistory() { past.length = 0; future.length = 0; gestureStart = null }

export const useRoadmapStore = create<Store>((set, get) => {
  let toastTimer: ReturnType<typeof setTimeout> | null = null
  let transTimer: ReturnType<typeof setTimeout> | null = null

  const showToast = (text: string) => {
    if (toastTimer) clearTimeout(toastTimer)
    set({ toast: { show: true, text } })
    toastTimer = setTimeout(() => set({ toast: null }), 2600)
  }

  const startTrans = () => {
    set(s => ({ tick: s.tick + 1, _tr: true }))
    if (transTimer) clearTimeout(transTimer)
    transTimer = setTimeout(() => set({ _tr: false }), 430)
  }

  const applySnapshot = (snap: Snapshot) => {
    historyPaused = true
    try {
      set(s => {
        const known = new Set(s.projects.map(p => p.id))
        const visible = new Set(s.visible)
        for (const p of snap.projects) if (!known.has(p.id)) visible.add(p.id)
        const editorGone = !!s.draft && !s.draft._new && !snap.items.some(i => i.id === s.draft!.id)
        return { ...snap, visible, ...(editorGone ? { panel: null, draft: null, draftOrig: null } : {}) }
      })
    } finally {
      historyPaused = false
    }
  }

  return {
    view: 'timeline',
    pxPerDay: SCALE_PRESETS[2],
    projects: INITIAL_PROJECTS,
    items: INITIAL_ITEMS,
    resources: INITIAL_RESOURCES,
    deps: INITIAL_DEPS,
    sprints: INITIAL_SPRINTS,
    settings: DEFAULT_SETTINGS,
    roles: INITIAL_ROLES,
    visible: new Set(INITIAL_PROJECTS.map(p => p.id)),
    expanded: new Set<string>(),
    railOpen: true,
    panel: null,
    draft: null,
    draftOrig: null,
    impact: null,
    pform: null,
    rform: null,
    sform: null,
    scenarios: [],
    activeScenarioId: null,
    officialScenarioId: null,
    scenarioForm: null,
    historyOpen: false,
    analysisOpen: false,
    checkpointForm: null,
    resSel: null,
    cell: null,
    contextMenu: null,
    showDeps: false,
    filterStartDay: null,
    filterEndDay: null,
    toast: null,
    viewport: { left: 0, width: 1000 },
    tick: 0,
    _tr: false,

    // Loads a scenario's full planning data — used both for the initial
    // boot and when switching to a different scenario. Clears any open
    // editing panel, since its ids belong to whichever scenario was active
    // before.
    hydrateScenario: data => {
      set({
        projects: data.projects,
        items: data.items,
        resources: data.resources,
        deps: data.deps,
        sprints: data.sprints,
        settings: data.settings,
        roles: data.roles,
        visible: new Set(data.projects.map(p => p.id)),
        panel: null, draft: null, draftOrig: null, cell: null, contextMenu: null, impact: null, resSel: null,
      })
      resetHistory()
    },
    hydrateView: v => set({ filterStartDay: v.filterStartDay, filterEndDay: v.filterEndDay }),
    setScenarioList: (scenarios, officialId) => set({ scenarios, officialScenarioId: officialId }),
    setActiveScenarioId: id => set({ activeScenarioId: id }),
    onNewScenario: () => set({ scenarioForm: { show: true, name: '', note: '' } }),
    patchScenarioForm: p => set(s => ({ scenarioForm: s.scenarioForm ? { ...s.scenarioForm, ...p } : null })),
    onScenarioFormCancel: () => set({ scenarioForm: null }),
    toggleHistory: () => set(s => ({ historyOpen: !s.historyOpen })),
    toggleAnalysis: () => set(s => ({ analysisOpen: !s.analysisOpen })),
    onNewCheckpoint: () => set({ checkpointForm: { show: true, name: '', note: '' } }),
    patchCheckpointForm: p => set(s => ({ checkpointForm: s.checkpointForm ? { ...s.checkpointForm, ...p } : null })),
    onCheckpointFormCancel: () => set({ checkpointForm: null }),

    setView: v => set({ view: v, panel: null, cell: null, contextMenu: null }),
    setScale: i => { startTrans(); set({ pxPerDay: SCALE_PRESETS[i] }) },
    zoom: f => { startTrans(); set(s => ({ pxPerDay: Math.max(1.8, Math.min(70, s.pxPerDay * f)) })) },
    toggleRail: () => set(s => ({ railOpen: !s.railOpen })),
    toggleProject: id => set(s => {
      const v = new Set(s.visible)
      if (v.has(id)) v.delete(id); else v.add(id)
      return { visible: v }
    }),
    toggleExpand: id => set(s => {
      const e = new Set(s.expanded)
      if (e.has(id)) e.delete(id); else e.add(id)
      return { expanded: e }
    }),
    setViewport: v => set({ viewport: v }),
    showToast,
    clearToast: () => set({ toast: null }),
    toggleDeps: () => set(s => ({ showDeps: !s.showDeps })),
    addDependency: (fromId, toId) => {
      if (fromId === toId) return
      if (get().deps.some(e => e.from === fromId && e.to === toId)) {
        showToast(t('That dependency already exists'))
        return
      }
      const id = 'e' + Date.now()
      set(s => ({ deps: [...s.deps, { id, from: fromId, to: toId }] }))
      showToast(t('Dependency added'))
    },
    setFilter: (startDay, endDay) => set({ filterStartDay: startDay, filterEndDay: endDay }),
    clearFilter: () => set({ filterStartDay: null, filterEndDay: null }),

    openItem: id => set(s => {
      const it = s.items.find(i => i.id === id)!
      const draft: Draft = { ...JSON.parse(JSON.stringify(it)), _deps: s.deps.filter(e => e.from === id).map(e => e.to) }
      return { panel: 'item', draft, draftOrig: it, cell: null }
    }),
    newItem: pid => set(s => {
      const r = projRange(s.items, pid)
      const day = r ? Math.round((r.a + r.b) / 2) : getTodayDay()
      const draft: Draft = { id: 'i' + Date.now(), projectId: pid, title: 'New item', startDay: day, dur: 21, status: 'Planned', type: 'task', assignments: [], _deps: [], _new: true }
      return { panel: 'item', draft, draftOrig: null, cell: null }
    }),
    // Right-click "create here" on the timeline canvas — same staging flow as
    // newItem, but at the day/project the user clicked instead of the
    // project's midpoint, and typed from the context menu choice.
    newItemAt: (pid, day, type = 'task') => set(() => {
      const isInstant = type === 'milestone' || type === 'release'
      const titles: Record<Item['type'], string> = { task: 'New task', epic: 'New epic', milestone: 'New milestone', release: 'New release' }
      const draft: Draft = { id: 'i' + Date.now(), projectId: pid, title: titles[type], startDay: day, dur: isInstant ? 0 : 14, status: 'Planned', type, assignments: [], _deps: [], _new: true }
      return { panel: 'item', draft, draftOrig: null, cell: null, contextMenu: null }
    }),
    duplicateItem: id => {
      const it = get().items.find(i => i.id === id)
      if (!it) return
      const copy: Item = { ...it, id: 'i' + Date.now(), title: `${it.title} (${t('copy')})`, startDay: it.startDay + it.dur + 3, assignments: it.assignments.map(a => ({ ...a })) }
      set(s => ({ items: [...s.items, copy] }))
      showToast(t('Item duplicated'))
    },
    deleteItemById: id => {
      set(s => ({
        items: s.items.filter(i => i.id !== id),
        deps: s.deps.filter(e => e.from !== id && e.to !== id),
        panel: s.draft?.id === id ? null : s.panel,
        draft: s.draft?.id === id ? null : s.draft,
        draftOrig: s.draft?.id === id ? null : s.draftOrig,
      }))
      showToast(t('Item deleted'))
    },
    openContextMenu: (x, y, projectId, day, itemId = null) => set({ contextMenu: { x, y, projectId, day, itemId } }),
    closeContextMenu: () => set(s => (s.contextMenu ? { contextMenu: null } : s)),
    clearPanel: () => set({ panel: null, draft: null, draftOrig: null, cell: null }),
    patchDraft: p => set(s => ({ draft: s.draft ? { ...s.draft, ...p } : null })),

    onDraftTitle: v => get().patchDraft({ title: v }),
    onDraftStatus: v => get().patchDraft({ status: v as Item['status'] }),
    // Empty option means "any role" — stored as undefined, not ''.
    onDraftRequiredRole: v => get().patchDraft({ requiredRole: v || undefined }),
    onDraftType: v => {
      const t = v as Item['type']
      const p: Partial<Draft> = { type: t }
      if (t === 'milestone' || t === 'release') p.dur = 0
      else if (get().draft?.dur === 0) p.dur = 21
      get().patchDraft(p)
    },
    onDraftStart: v => {
      if (!v) return
      const off = offFromStr(v)
      const d = get().draft!
      const end = d.startDay + d.dur
      get().patchDraft({ startDay: off, dur: Math.max(d.dur === 0 ? 0 : 1, end - off) })
    },
    onDraftEnd: v => {
      if (!v) return
      const off = offFromStr(v)
      const d = get().draft!
      get().patchDraft({ dur: Math.max(1, off - d.startDay) })
    },
    onAddAssignee: id => {
      const d = get().draft!
      if (d.assignments.some(a => a.r === id)) return
      get().patchDraft({ assignments: [...d.assignments, { r: id, pct: 50 }] })
    },
    setAssignPct: (rid, v) => {
      const d = get().draft!
      get().patchDraft({ assignments: d.assignments.map(a => a.r === rid ? { r: rid, pct: Math.max(0, Math.min(200, v)) } : a) })
    },
    removeAssign: rid => {
      const d = get().draft!
      get().patchDraft({ assignments: d.assignments.filter(a => a.r !== rid) })
    },
    onAddDep: id => {
      const d = get().draft!
      if (d._deps.includes(id)) return
      get().patchDraft({ _deps: [...d._deps, id] })
    },
    removeDep: id => {
      const d = get().draft!
      get().patchDraft({ _deps: d._deps.filter(x => x !== id) })
    },
    onSaveItem: () => {
      const { draft, draftOrig, items, deps } = get()
      if (!draft) return
      const imp = computeImpact(draft, draftOrig, items, deps, get().resources)
      set({ impact: { show: true, draft, orig: draftOrig, imp } })
    },
    commitItem: () => {
      const impact = get().impact!
      const { draft, orig } = impact
      const clean = (d: Draft): Item => { const c = { ...d } as Partial<Draft>; delete c._deps; delete c._new; return c as Item }
      const items = orig ? get().items.map(i => i.id === draft.id ? clean(draft) : i) : [...get().items, clean(draft)]
      let deps = get().deps.filter(e => e.from !== draft.id)
      let de = Date.now()
      for (const t of draft._deps) deps = [...deps, { id: 'e' + de++, from: draft.id, to: t }]
      set({ items, deps, impact: null, panel: null, draft: null, draftOrig: null })
      showToast(orig ? t('Item updated') : t('Item created'))
    },
    onDeleteItem: () => {
      const id = get().draft!.id
      set(s => ({
        items: s.items.filter(i => i.id !== id),
        deps: s.deps.filter(e => e.from !== id && e.to !== id),
        panel: null, draft: null, draftOrig: null,
      }))
      showToast(t('Item deleted'))
    },
    startDrag: (id, mode, clientX) => {
      const { items, deps, pxPerDay } = get()
      const it = items.find(i => i.id === id)!
      const sx = clientX
      const s0 = it.startDay, d0 = it.dur
      const ppd = pxPerDay
      beginGesture(takeSnapshot(get()))

      const move = (ev: PointerEvent) => {
        const dd = Math.round((ev.clientX - sx) / ppd)
        if (dd !== 0) dragMoved = true
        const patch = (x: Item): Item => mode === 'move' ? { ...x, startDay: s0 + dd } : { ...x, dur: Math.max(1, d0 + dd) }
        set(s => ({
          items: s.items.map(x => x.id === id ? patch(x) : x),
          draft: s.draft?.id === id && !s.draft._new ? { ...s.draft, ...patch(s.draft) } : s.draft,
        }))
      }
      const up = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', up)
        endGesture(takeSnapshot(get()))
        if (!dragMoved) return
        const it2 = get().items.find(i => i.id === id)!
        const imp = computeImpact({ ...it2, _deps: deps.filter(e => e.from === id).map(e => e.to) }, it2, get().items, deps, get().resources)
        const n = imp.deps.filter(d => d.clash).length + imp.resources.filter(r => r.over).length
        const proj = get().projects.find(p => p.id === it2.projectId)!
        showToast(n ? t(n > 1 ? '{proj} rescheduled · {n} conflicts' : '{proj} rescheduled · {n} conflict', { proj: proj.name.split(' ')[0], n }) : t('Rescheduled — no conflicts'))
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', up)
      return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up) }
    },

    onNewProject: () => set(s => ({
      pform: { show: true, id: null, name: '', desc: '', owner: 'r1', category: 'Product', startStr: dateStr(getTodayDay()), endStr: dateStr(getTodayDay() + 90), status: 'Planned', defaultTasks: true }
    })),
    editProject: id => set(s => {
      const p = s.projects.find(pr => pr.id === id)!
      const r = projRange(s.items, id)
      return { pform: { show: true, id, name: p.name, desc: p.desc, owner: p.owner, category: p.category, startStr: dateStr(r ? r.a : getTodayDay()), endStr: dateStr(r ? r.b : getTodayDay() + 90), status: p.status, canDelete: true } }
    }),
    patchPF: p => set(s => ({ pform: s.pform ? { ...s.pform, ...p } : null })),
    onPSave: () => {
      const f = get().pform!
      if (f.id) {
        set(s => ({ projects: s.projects.map(p => p.id === f.id ? { ...p, name: f.name, desc: f.desc, owner: f.owner, category: f.category, status: f.status } : p), pform: null }))
        showToast(t('Project updated'))
      } else {
        const id = 'p' + Date.now()
        const color = PROJECT_COLORS[get().projects.length % PROJECT_COLORS.length]
        const np: Project = { id, name: f.name || 'Untitled project', desc: f.desc, owner: f.owner, category: f.category, color, status: f.status }

        let newItems: Item[] = []
        if (f.defaultTasks) {
          const start = offFromStr(f.startStr)
          const end = Math.max(start + DEFAULT_PROJECT_TASKS.length, offFromStr(f.endStr))
          const share = Math.floor((end - start) / DEFAULT_PROJECT_TASKS.length)
          let cursor = start
          newItems = DEFAULT_PROJECT_TASKS.map((title, i) => {
            const isLast = i === DEFAULT_PROJECT_TASKS.length - 1
            const dur = Math.max(1, isLast ? end - cursor : share)
            const it: Item = { id: `i${Date.now()}_${i}`, projectId: id, title, startDay: cursor, dur, status: 'Planned', type: 'task', assignments: [] }
            cursor += dur
            return it
          })
        }

        set(s => {
          const v = new Set(s.visible); v.add(id)
          return { projects: [...s.projects, np], items: [...s.items, ...newItems], visible: v, pform: null }
        })
        showToast(f.defaultTasks ? t('Project created with default tasks') : t('Project created'))
      }
    },
    onPCancel: () => set({ pform: null }),
    onPDelete: () => {
      const id = get().pform!.id!
      const itemIds = get().items.filter(i => i.projectId === id).map(i => i.id)
      set(s => ({
        projects: s.projects.filter(p => p.id !== id),
        items: s.items.filter(i => i.projectId !== id),
        deps: s.deps.filter(e => !itemIds.includes(e.from) && !itemIds.includes(e.to)),
        pform: null,
      }))
      showToast(t('Project deleted'))
    },

    openRes: rid => set({ resSel: rid, panel: 'res', cell: null, draft: null }),
    openCell: (rid, bIdx, bucket) => set({ cell: { rid, bIdx, bucket }, panel: 'cell' }),

    onNewResource: () => set({ rform: { show: true, id: null, name: '', role: 'Engineering', cost: 0, costUnit: 'month', availability: 100 } }),
    editResource: id => {
      const r = get().resources.find(r => r.id === id)!
      set({ rform: { show: true, id, name: r.name, role: r.role, cost: r.cost, costUnit: r.costUnit, availability: resourceCapacity(r), canDelete: true } })
    },
    patchRF: p => set(s => ({ rform: s.rform ? { ...s.rform, ...p } : null })),
    onRSave: () => {
      const f = get().rform!
      if (f.id) {
        set(s => ({ resources: s.resources.map(r => r.id === f.id ? { ...r, name: f.name || r.name, role: f.role, cost: f.cost, costUnit: f.costUnit, availability: f.availability } : r), rform: null }))
        showToast(t('Resource updated'))
      } else {
        const id = 'r' + Date.now()
        set(s => ({ resources: [...s.resources, { id, name: f.name || 'New person', role: f.role || '', cost: f.cost, costUnit: f.costUnit, availability: f.availability }], rform: null }))
        showToast(t('Resource added'))
      }
    },
    onRCancel: () => set({ rform: null }),
    onRDelete: () => {
      const id = get().rform!.id!
      const closePanel = get().panel === 'res' && get().resSel === id
      set(s => ({
        resources: s.resources.filter(r => r.id !== id),
        items: s.items.map(it => ({ ...it, assignments: it.assignments.filter(a => a.r !== id) })),
        rform: null,
        panel: closePanel ? null : s.panel,
      }))
      showToast(t('Resource removed'))
    },

    onNewSprint: () => {
      const sprints = get().sprints
      const start = sprints.length ? Math.max(...sprints.map(s => s.startDay + s.dur)) : 0
      set({ sform: { show: true, id: null, name: `Sprint ${sprints.length + 1}`, startStr: dateStr(start), endStr: dateStr(start + 14) } })
    },
    editSprint: id => {
      const s = get().sprints.find(s => s.id === id)!
      set({ sform: { show: true, id, name: s.name, startStr: dateStr(s.startDay), endStr: dateStr(s.startDay + s.dur), canDelete: true } })
    },
    patchSF: p => set(s => ({ sform: s.sform ? { ...s.sform, ...p } : null })),
    onSFSave: () => {
      const f = get().sform!
      const startDay = offFromStr(f.startStr)
      const dur = Math.max(1, offFromStr(f.endStr) - startDay)
      if (f.id) {
        set(s => ({ sprints: s.sprints.map(sp => sp.id === f.id ? { ...sp, name: f.name || sp.name, startDay, dur } : sp), sform: null }))
        showToast(t('Sprint updated'))
      } else {
        const id = 'sp' + Date.now()
        set(s => ({ sprints: [...s.sprints, { id, name: f.name || 'Sprint', startDay, dur }], sform: null }))
        showToast(t('Sprint added'))
      }
    },
    onSFCancel: () => set({ sform: null }),
    onSFDelete: () => {
      const id = get().sform!.id!
      set(s => ({ sprints: s.sprints.filter(sp => sp.id !== id), sform: null }))
      showToast(t('Sprint removed'))
    },
    startSprintDrag: (id, mode, clientX) => {
      const { pxPerDay } = get()
      const sp = get().sprints.find(s => s.id === id)!
      const sx = clientX
      const s0 = sp.startDay, d0 = sp.dur
      const ppd = pxPerDay
      beginGesture(takeSnapshot(get()))

      const move = (ev: PointerEvent) => {
        const dd = Math.round((ev.clientX - sx) / ppd)
        if (dd !== 0) dragMoved = true
        set(s => ({
          sprints: s.sprints.map(x => {
            if (x.id !== id) return x
            if (mode === 'move') return { ...x, startDay: s0 + dd }
            return { ...x, dur: Math.max(1, d0 + dd) }
          })
        }))
      }
      const up = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', up)
        endGesture(takeSnapshot(get()))
        if (dragMoved) showToast(t('Sprint rescheduled'))
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', up)
      return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up) }
    },

    // Applies a snapshot without recording it as a new change (the subscriber
    // is paused), and repairs UI state that pointed at data the snapshot
    // changes: restored projects are made visible, and an open editor for an
    // item that no longer exists is closed.
    undo: () => {
      if (gestureStart) return
      const prev = past.pop()
      if (!prev) { showToast(t('Nothing to undo')); return }
      future.push(takeSnapshot(get()))
      applySnapshot(prev)
      showToast(t('Change undone'))
    },
    redo: () => {
      if (gestureStart) return
      const next = future.pop()
      if (!next) { showToast(t('Nothing to redo')); return }
      past.push(takeSnapshot(get()))
      applySnapshot(next)
      showToast(t('Change redone'))
    },

    patchSettings: p => set(s => ({ settings: { ...s.settings, ...p } })),
    addHoliday: date => set(s => {
      if (s.settings.holidays.includes(date)) return s
      return { settings: { ...s.settings, holidays: [...s.settings.holidays, date].sort() } }
    }),
    removeHoliday: date => set(s => ({ settings: { ...s.settings, holidays: s.settings.holidays.filter(h => h !== date) } })),

    addRole: (name, icon) => {
      const trimmed = name.trim()
      if (!trimmed) return
      if (get().roles.some(r => r.name.toLowerCase() === trimmed.toLowerCase())) { showToast(t('That role already exists')); return }
      set(s => ({ roles: [...s.roles, { name: trimmed, icon }] }))
      showToast(t('Role added'))
    },
    // Blocked while in use rather than cascaded: unlike a resource (whose
    // assignments are just removable list entries), Resource.role is a
    // required field — clearing it on delete would leave people with no
    // role instead of a clean removal.
    removeRole: name => {
      const inUse = get().resources.some(r => r.role === name) || get().items.some(i => i.requiredRole === name)
      if (inUse) { showToast(t('Remove it from people and tasks before deleting')); return }
      set(s => ({ roles: s.roles.filter(r => r.name !== name) }))
      showToast(t('Role removed'))
    },
    renameRole: (oldName, newName) => {
      const trimmed = newName.trim()
      if (!trimmed || trimmed === oldName) return
      if (get().roles.some(r => r.name.toLowerCase() === trimmed.toLowerCase() && r.name !== oldName)) { showToast(t('That role already exists')); return }
      set(s => ({
        roles: s.roles.map(r => r.name === oldName ? { ...r, name: trimmed } : r),
        resources: s.resources.map(r => r.role === oldName ? { ...r, role: trimmed } : r),
        items: s.items.map(i => i.requiredRole === oldName ? { ...i, requiredRole: trimmed } : i),
      }))
      showToast(t('Role renamed'))
    },
    setRoleIcon: (name, icon) => set(s => ({ roles: s.roles.map(r => r.name === name ? { ...r, icon } : r) })),

    agentCreateResource: data => {
      const id = 'r' + Date.now()
      set(s => ({ resources: [...s.resources, { id, name: data.name, role: data.role, cost: data.cost, costUnit: data.costUnit ?? 'month' }] }))
      showToast(t('Added {name}', { name: data.name }))
    },
    agentUpdateResource: (id, patch) => {
      if (!get().resources.some(r => r.id === id)) { showToast(t("Couldn't find that person")); return }
      set(s => ({ resources: s.resources.map(r => r.id === id ? { ...r, ...patch } : r) }))
      showToast(t('Resource updated'))
    },
    agentCreateProject: data => {
      const id = 'p' + Date.now()
      const color = PROJECT_COLORS[get().projects.length % PROJECT_COLORS.length]
      const np: Project = {
        id, name: data.name, desc: data.desc ?? '', owner: data.owner,
        category: data.category ?? 'Product', color, status: data.status ?? 'Planned',
      }
      set(s => { const v = new Set(s.visible); v.add(id); return { projects: [...s.projects, np], visible: v } })
      showToast(t('Project "{name}" created', { name: data.name }))
    },
    agentUpdateProject: (id, patch) => {
      if (!get().projects.some(p => p.id === id)) { showToast(t("Couldn't find that project")); return }
      set(s => ({ projects: s.projects.map(p => p.id === id ? { ...p, ...patch } : p) }))
      showToast(t('Project updated'))
    },

    agentCreateItem: data => {
      const id = 'i' + Date.now()
      const isInstant = data.type === 'milestone' || data.type === 'release'
      const item: Item = {
        id, projectId: data.projectId, title: data.title, type: data.type,
        startDay: data.startDay, dur: isInstant ? 0 : Math.max(1, data.dur),
        status: data.status ?? 'Planned', assignments: [],
        ...(data.requiredRole && { requiredRole: data.requiredRole }),
      }
      set(s => ({ items: [...s.items, item] }))
      showToast(t('Added "{title}"', { title: data.title }))
    },
    agentUpdateItem: (id, patch) => {
      if (!get().items.some(i => i.id === id)) { showToast(t("Couldn't find that item")); return }
      set(s => ({ items: s.items.map(i => i.id === id ? { ...i, ...patch } : i) }))
      showToast(t('Item updated'))
    },
  }
})

useRoadmapStore.subscribe((state, prev) => {
  if (historyPaused || gestureStart || sameRefs(state, prev)) return
  recordPast(takeSnapshot(prev))
})
