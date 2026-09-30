'use client'

import { create } from 'zustand'
import type { DateStyle } from './dateFormat'

// Per-person preferences (Settings → Preferences): saved in this browser,
// never in the plan. Starts with the defaults on both server and client and
// loads the saved values after hydration (useDateFormatSync), so the first
// render matches the server's.
const KEY = 'roadmap-preferences'

interface Preferences {
  dateStyle: DateStyle
  loaded: boolean
  load: () => void
  setDateStyle: (s: DateStyle) => void
}

function save(p: Pick<Preferences, 'dateStyle'>): void {
  try { window.localStorage.setItem(KEY, JSON.stringify(p)) } catch { /* private mode or blocked storage: keep it for this session */ }
}

export const usePreferences = create<Preferences>((set, get) => ({
  dateStyle: 'auto',
  loaded: false,
  load: () => {
    if (get().loaded) return
    let saved: Partial<Preferences> = {}
    try { saved = JSON.parse(window.localStorage.getItem(KEY) ?? '{}') } catch { /* unreadable or blocked: defaults */ }
    set({ dateStyle: saved.dateStyle === 'numeric' ? 'numeric' : 'auto', loaded: true })
  },
  setDateStyle: dateStyle => {
    set({ dateStyle })
    save({ dateStyle })
  },
}))
