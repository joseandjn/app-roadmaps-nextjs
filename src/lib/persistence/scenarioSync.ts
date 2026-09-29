'use client'

import { useRoadmapStore } from '@/store/useRoadmapStore'
import { t } from '@/lib/i18n/translations'
import type { ScenarioData } from '@/types'

// Keeps the open scenario in step with what's on disk when it's open in more
// than one tab (or browser). Every load remembers the file's revision, every
// save sends it back, and the server refuses a save against an older one, so
// a tab can never silently overwrite changes it hasn't seen. Saves are also
// announced to the other tabs of this browser, which reload right away.

const SAVE_DEBOUNCE_MS = 600
const CHANNEL = 'roadmap-scenario-sync'
const POLL_MS = 30000

let rev: string | null = null         // revision of the scenario data in the store
let revScenarioId: string | null = null
let applying = false                   // loading data in; the autosave must ignore it
let saveTimer: ReturnType<typeof setTimeout> | null = null
let saving: Promise<void> = Promise.resolve()
let inFlight = 0
let channel: BroadcastChannel | null = null

const revFrom = (res: Response) => res.headers.get('etag')?.replace(/^W\//, '').replace(/"/g, '') ?? null

// True while a load is replacing the store's data, so the autosave doesn't
// write straight back what it just read.
export function isApplyingScenario(): boolean {
  return applying
}

function apply(id: string, data: ScenarioData, newRev: string | null) {
  applying = true
  try { useRoadmapStore.getState().hydrateScenario(data) } finally { applying = false }
  rev = newRev
  revScenarioId = id
}

// Loads a scenario into the store and remembers its revision.
export async function loadScenario(id: string): Promise<boolean> {
  const res = await fetch(`/api/scenarios/${id}`, { cache: 'no-store' })
  if (!res.ok) return false
  apply(id, await res.json() as ScenarioData, revFrom(res))
  return true
}

function announce(scenarioId: string, newRev: string) {
  channel?.postMessage({ scenarioId, rev: newRev })
}

function conflict(id: string, data: ScenarioData, newRev: string | null) {
  apply(id, data, newRev)
  if (newRev) announce(id, newRev)
  useRoadmapStore.getState().showToast(t('Another tab saved changes to this scenario. The latest version was loaded; your last change was not saved.'))
}

async function save(): Promise<void> {
  const { activeScenarioId: id, projects, items, resources, deps, sprints, settings, roles } = useRoadmapStore.getState()
  if (!id) return
  inFlight++
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (rev && revScenarioId === id) headers['If-Match'] = `"${rev}"`
    const res = await fetch(`/api/scenarios/${id}`, {
      method: 'PUT', headers,
      body: JSON.stringify({ projects, items, resources, deps, sprints, settings, roles }),
    })
    if (res.ok) {
      const { rev: newRev } = await res.json() as { rev: string }
      rev = newRev
      revScenarioId = id
      announce(id, newRev)
    } else if (res.status === 409) {
      const body = await res.json() as { data: ScenarioData; rev: string }
      conflict(id, body.data, body.rev)
    } else if (res.status === 428) {
      // No known revision (e.g. the page's code was hot-reloaded): don't risk
      // an overwrite, take what's on disk.
      const latest = await fetch(`/api/scenarios/${id}`, { cache: 'no-store' })
      if (latest.ok) conflict(id, await latest.json() as ScenarioData, revFrom(latest))
    }
  } catch {
    // offline/unreachable — the next change retries with the same revision
  } finally {
    inFlight--
  }
}

// Saves run one after another, so each one sends the revision the previous
// one got back.
function runSave(): Promise<void> {
  saving = saving.then(save)
  return saving
}

export function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => { saveTimer = null; runSave() }, SAVE_DEBOUNCE_MS)
}

// Saves any pending change now (before a checkpoint or a scenario switch).
export function flushSave(): Promise<void> {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; return runSave() }
  return saving
}

// Another tab or browser saved: reload, unless nothing changed. If this tab
// had an unsaved change, that change can't be saved on top, so say so.
async function reloadIfChanged(scenarioId: string, knownRev?: string) {
  const { activeScenarioId } = useRoadmapStore.getState()
  if (scenarioId !== activeScenarioId || inFlight > 0) return
  if (knownRev && knownRev === rev) return
  const headers: Record<string, string> = rev && revScenarioId === scenarioId ? { 'If-None-Match': `"${rev}"` } : {}
  const res = await fetch(`/api/scenarios/${scenarioId}`, { cache: 'no-store', headers }).catch(() => null)
  if (!res || res.status === 304 || !res.ok) return
  if (useRoadmapStore.getState().activeScenarioId !== scenarioId || inFlight > 0) return
  const data = await res.json() as ScenarioData
  if (saveTimer) {
    clearTimeout(saveTimer); saveTimer = null
    conflict(scenarioId, data, revFrom(res))
  } else {
    apply(scenarioId, data, revFrom(res))
    useRoadmapStore.getState().showToast(t('Updated with changes from another tab'))
  }
}

// Tells the other tabs of this browser that another scenario was saved from
// here (a copy into it), so a tab showing it reloads right away.
export function announceScenarioRevision(scenarioId: string, newRev: string): void {
  announce(scenarioId, newRev)
}

// Tells the other tabs of this browser that a scenario changed outside the
// autosave (a checkpoint restore), so they reload it.
export function announceScenarioChanged(scenarioId: string): void {
  if (rev && revScenarioId === scenarioId) announce(scenarioId, rev)
}

// Listens for saves from other tabs, and re-checks the disk when this tab
// comes back into view or focus and every POLL_MS while it's in use (for
// saves from other browsers or machines, which can't broadcast here; an
// unchanged scenario answers 304 with no body). Returns the cleanup.
export function startScenarioSync(): () => void {
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(CHANNEL)
    channel.onmessage = (e: MessageEvent<{ scenarioId: string; rev: string }>) => { reloadIfChanged(e.data.scenarioId, e.data.rev) }
  }
  const check = () => {
    const { activeScenarioId } = useRoadmapStore.getState()
    const inUse = document.visibilityState === 'visible' || document.hasFocus()
    if (inUse && activeScenarioId) reloadIfChanged(activeScenarioId)
  }
  document.addEventListener('visibilitychange', check)
  window.addEventListener('focus', check)
  const poll = setInterval(check, POLL_MS)
  return () => {
    document.removeEventListener('visibilitychange', check)
    window.removeEventListener('focus', check)
    clearInterval(poll)
    channel?.close()
    channel = null
  }
}
