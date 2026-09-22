'use client'

import { useCallback, useRef, useState, useSyncExternalStore } from 'react'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import { offFromStr } from '@/lib/roadmapUtils'
import { t } from '@/lib/i18n/translations'
import { getSpeechRecognitionCtor, type SpeechRecognition } from './speechRecognition'
import type { VoiceCommandResult } from '@/lib/agent/roadmapAgent'
import type { Item } from '@/types'

const DEFAULT_ITEM_SPAN_DAYS = 21 // matches the store's own newItem() default

export type VoiceStatus = 'idle' | 'listening' | 'thinking'

// Browser support never changes after mount, so subscribe is a no-op —
// this just reads a browser-only value (window.SpeechRecognition) without
// a hydration mismatch: the server snapshot is always `false` (no `window`
// there), the client snapshot reflects the real browser.
const noopSubscribe = () => () => {}

export function useVoiceCommand() {
  const [status, setStatus] = useState<VoiceStatus>('idle')
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => getSpeechRecognitionCtor() !== null,
    () => false
  )
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  // Whether the user has an open voice session (start()'d, not yet stop()'d).
  // Distinct from `status`, which also flips through 'thinking' per-command —
  // this tracks the session itself, so a mid-command status blip can't be
  // mistaken for "click to start" in the UI, and so onend knows whether a
  // stoppage was requested or something the browser did on its own.
  const sessionActiveRef = useRef(false)

  const showToast = useRoadmapStore(s => s.showToast)
  const agentCreateResource = useRoadmapStore(s => s.agentCreateResource)
  const agentUpdateResource = useRoadmapStore(s => s.agentUpdateResource)
  const agentCreateProject = useRoadmapStore(s => s.agentCreateProject)
  const agentUpdateProject = useRoadmapStore(s => s.agentUpdateProject)
  const agentCreateItem = useRoadmapStore(s => s.agentCreateItem)
  const agentUpdateItem = useRoadmapStore(s => s.agentUpdateItem)
  const resources = useRoadmapStore(s => s.resources)
  const projects = useRoadmapStore(s => s.projects)
  const items = useRoadmapStore(s => s.items)
  const openRes = useRoadmapStore(s => s.openRes)
  const openItem = useRoadmapStore(s => s.openItem)
  const editResource = useRoadmapStore(s => s.editResource)
  const editProject = useRoadmapStore(s => s.editProject)
  const setFilter = useRoadmapStore(s => s.setFilter)

  const runCommand = useCallback(async (transcript: string) => {
    setStatus('thinking')
    try {
      const res = await fetch('/api/voice-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      })
      const data = (await res.json()) as VoiceCommandResult | { type: 'error'; error: string }

      if (!res.ok || data.type === 'error') {
        showToast(data.type === 'error' ? data.error : t('Voice command failed'))
        return
      }
      if (data.type === 'message') {
        showToast(data.text)
        return
      }

      const input = data.input
      switch (data.name) {
        case 'create_resource':
          agentCreateResource(input as { name: string; role: string; cost: number; costUnit?: 'month' | 'hour' })
          break
        case 'update_resource':
          agentUpdateResource(input.id as string, input)
          break
        case 'create_project':
          agentCreateProject(input as { name: string; desc?: string; owner: string; category?: string })
          break
        case 'update_project':
          agentUpdateProject(input.id as string, input)
          break
        case 'show_resource': {
          const r = resources.find(x => x.id === input.id)
          if (!r) { showToast(t("Couldn't find that person")); break }
          openRes(r.id)
          showToast(t('Showing {name}', { name: r.name }))
          break
        }
        case 'show_project': {
          const p = projects.find(x => x.id === input.id)
          if (!p) { showToast(t("Couldn't find that project")); break }
          editProject(p.id)
          showToast(t('Showing {name}', { name: p.name }))
          break
        }
        case 'go_to_date': {
          const day = offFromStr(input.date as string)
          setFilter(day, null)
          showToast(t('Jumped to {date}', { date: input.date as string }))
          break
        }
        case 'delete_resource': {
          const r = resources.find(x => x.id === input.id)
          if (!r) { showToast(t("Couldn't find that person")); break }
          editResource(r.id)
          showToast(t('Confirm deleting {name} — click Remove in the panel, or Cancel', { name: r.name }))
          break
        }
        case 'delete_project': {
          const p = projects.find(x => x.id === input.id)
          if (!p) { showToast(t("Couldn't find that project")); break }
          editProject(p.id)
          showToast(t('Confirm deleting {name} — click Remove in the panel, or Cancel', { name: p.name }))
          break
        }
        case 'create_item': {
          const p = projects.find(x => x.id === input.projectId)
          if (!p) { showToast(t("Couldn't find that project")); break }
          const type = input.type as Item['type']
          const isInstant = type === 'milestone' || type === 'release'
          const startDay = offFromStr(input.startDate as string)
          const dur = isInstant ? 0
            : input.endDate ? Math.max(1, offFromStr(input.endDate as string) - startDay)
            : DEFAULT_ITEM_SPAN_DAYS
          agentCreateItem({
            projectId: p.id,
            title: input.title as string,
            type,
            startDay,
            dur,
            status: input.status as Item['status'] | undefined,
            requiredRoles: Array.isArray(input.requiredRoles) ? input.requiredRoles as string[] : undefined,
          })
          break
        }
        case 'update_item': {
          const it = items.find(x => x.id === input.id)
          if (!it) { showToast(t("Couldn't find that task")); break }
          const patch: Partial<{ title: string; type: Item['type']; status: Item['status']; startDay: number; dur: number; requiredRoles: string[] | undefined }> = {}
          if (input.title) patch.title = input.title as string
          if (input.status) patch.status = input.status as Item['status']
          if (input.type) patch.type = input.type as Item['type']
          // The tool uses [] to mean "clear it" (undefined means "not mentioned, leave as is").
          if (Array.isArray(input.requiredRoles)) patch.requiredRoles = (input.requiredRoles as string[]).length ? input.requiredRoles as string[] : undefined
          const isInstant = (patch.type ?? it.type) === 'milestone' || (patch.type ?? it.type) === 'release'
          // No endDate: a move that preserves duration. No startDate: a resize
          // that keeps the current start. Both: an explicit reposition.
          const startDay = input.startDate ? offFromStr(input.startDate as string) : it.startDay
          if (isInstant) {
            patch.dur = 0
            if (input.startDate) patch.startDay = startDay
          } else if (input.startDate || input.endDate) {
            const endDay = input.endDate ? offFromStr(input.endDate as string) : it.startDay + it.dur
            patch.startDay = startDay
            patch.dur = Math.max(1, endDay - startDay)
          }
          agentUpdateItem(it.id, patch)
          break
        }
        case 'show_item': {
          const it = items.find(x => x.id === input.id)
          if (!it) { showToast(t("Couldn't find that task")); break }
          openItem(it.id)
          showToast(t('Showing {name}', { name: it.title }))
          break
        }
        case 'delete_item': {
          const it = items.find(x => x.id === input.id)
          if (!it) { showToast(t("Couldn't find that task")); break }
          openItem(it.id)
          showToast(t('Confirm deleting {name} — click Delete in the panel, or Cancel', { name: it.title }))
          break
        }
        default:
          showToast(t("Didn't recognize that action"))
      }
    } catch {
      showToast(t('Voice command failed'))
    } finally {
      // A continuous session keeps listening between commands — only drop
      // to 'idle' once the session has actually been stopped.
      setStatus(sessionActiveRef.current ? 'listening' : 'idle')
    }
  }, [
    showToast, agentCreateResource, agentUpdateResource, agentCreateProject, agentUpdateProject,
    agentCreateItem, agentUpdateItem, resources, projects, items,
    openRes, openItem, editResource, editProject, setFilter,
  ])

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      showToast(t('Voice input is not supported in this browser'))
      return
    }
    const recognition = new Ctor()
    recognition.lang = navigator.language
    recognition.interimResults = false
    // Continuous mode: the mic stays open across multiple spoken commands
    // instead of stopping after one. Each completed phrase still fires its
    // own `onresult` (Chrome keeps appending to `event.results`, so the
    // last entry is always the newest phrase — grabbing just that one below
    // is correct with or without continuous mode).
    recognition.continuous = true
    recognition.onresult = event => {
      const last = event.results[event.results.length - 1]
      runCommand(last[0].transcript)
    }
    recognition.onerror = event => {
      // Silence between commands routinely surfaces as "no-speech" in
      // continuous mode — that's normal mid-session, not a real failure,
      // and Chrome typically fires `onend` right after anyway, which
      // resumes the session below. Anything else genuinely ends it.
      if (event.error === 'no-speech' || event.error === 'aborted') return
      sessionActiveRef.current = false
      setStatus('idle')
      showToast(t('Voice session stopped — could not hear you'))
    }
    recognition.onend = () => {
      if (sessionActiveRef.current) {
        // Chrome can end a continuous session on its own (silence timeout,
        // network hiccup) without the user asking to stop — resume it so
        // "continuous" actually holds across a whole multi-command session.
        try { recognition.start() } catch { /* already starting */ }
      } else {
        setStatus('idle')
      }
    }
    recognitionRef.current = recognition
    sessionActiveRef.current = true
    setStatus('listening')
    recognition.start()
  }, [runCommand, showToast])

  const stop = useCallback(() => {
    sessionActiveRef.current = false
    recognitionRef.current?.stop()
  }, [])

  return { status, supported, start, stop }
}
