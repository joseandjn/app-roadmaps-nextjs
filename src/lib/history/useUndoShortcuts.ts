'use client'

import { useEffect } from 'react'
import { useRoadmapStore } from '@/store/useRoadmapStore'

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

// Cmd/Ctrl+Z undoes, Cmd/Ctrl+Shift+Z (or Ctrl+Y) redoes. Skipped while typing
// so text fields keep their native undo, and while any modal/form is open so
// data can't change underneath it.
export function useUndoShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return
      const key = e.key.toLowerCase()
      const isUndo = key === 'z' && !e.shiftKey
      const isRedo = (key === 'z' && e.shiftKey) || (key === 'y' && e.ctrlKey && !e.metaKey)
      if (!isUndo && !isRedo) return

      const el = e.target as HTMLElement | null
      if (el && (el.isContentEditable || EDITABLE_TAGS.has(el.tagName))) return

      const s = useRoadmapStore.getState()
      if (s.impact || s.pform || s.rform || s.sform || s.scenarioForm || s.checkpointForm || s.historyOpen || s.analysisOpen) return

      e.preventDefault()
      if (isUndo) s.undo(); else s.redo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
