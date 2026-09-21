'use client'

import { useSyncExternalStore } from 'react'
import { getTodayDay } from '@/data/initialData'

const subscribe = () => () => {}

// "Today" depends on the viewer's clock and timezone, which the server can't know.
// null during SSR/hydration so the markup matches; the real day follows on the client.
export function useTodayDay(): number | null {
  return useSyncExternalStore(subscribe, getTodayDay, () => null)
}
