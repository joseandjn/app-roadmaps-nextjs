'use client'

export type Locale = 'en' | 'es'

const STORAGE_KEY = 'roadmap-locale'
let listeners: Array<() => void> = []
let current: Locale | null = null

function detectLocale(): Locale {
  if (typeof window === 'undefined') return 'en'
  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (saved === 'en' || saved === 'es') return saved
  return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en'
}

export function getLocale(): Locale {
  if (current === null) current = detectLocale()
  return current
}

// Matches server-rendered HTML, which has no access to the browser's
// language or localStorage — always 'en'. useTranslation swaps to the real
// detected locale on the client via useSyncExternalStore, same hydration-safe
// pattern useVoiceCommand uses for its browser-support check.
export function getServerLocale(): Locale {
  return 'en'
}

export function setLocale(locale: Locale): void {
  current = locale
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, locale)
  for (const l of listeners) l()
}

export function subscribeLocale(cb: () => void): () => void {
  listeners.push(cb)
  return () => { listeners = listeners.filter(l => l !== cb) }
}
