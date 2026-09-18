'use client'

import { useCallback } from 'react'
import { useSyncExternalStore } from 'react'
import { getLocale, getServerLocale, subscribeLocale, setLocale, type Locale } from './localeStore'
import { translate } from './translations'

export function useTranslation() {
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getServerLocale)
  const t = useCallback(
    (text: string, params?: Record<string, string | number>) => translate(locale, text, params),
    [locale]
  )
  return { t, locale, setLocale }
}

export type { Locale }
