'use client'

import { useEffect } from 'react'
import { configureDates } from './dateFormat'
import { usePreferences } from './preferences'
import { useTranslation } from './i18n/useTranslation'
import { useRoadmapStore } from '@/store/useRoadmapStore'

// Applies the app's language and the date format preference to every date
// the app writes (fmtDate, timeline headers). Runs after hydration, like the
// texts, so the first render matches the server's English one; bumping
// `tick` then re-renders what shows dates.
export function useDateFormatSync(): void {
  const { locale } = useTranslation()
  const dateStyle = usePreferences(s => s.dateStyle)
  useEffect(() => { usePreferences.getState().load() }, [])
  useEffect(() => {
    configureDates({ locale, style: dateStyle })
    useRoadmapStore.setState(s => ({ tick: s.tick + 1 }))
  }, [locale, dateStyle])
}
