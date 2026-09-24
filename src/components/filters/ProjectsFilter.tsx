'use client'

import { useRoadmapStore } from '@/store/useRoadmapStore'
import { useTranslation } from '@/lib/i18n/useTranslation'
import FilterChip, { FilterShortcut } from './FilterChip'

// Projects chip: a view over `visible`, the same set the LeftRail checkboxes
// toggle. The chip treats "nothing selected" as "no restriction", so all
// projects visible reads as an empty selection, and picking one project
// from that state narrows the view to just that one.
export default function ProjectsFilter() {
  const { projects, resources, visible, setVisibleProjects } = useRoadmapStore()
  const { t } = useTranslation()

  const allVisible = projects.every(p => visible.has(p.id))
  const selected = allVisible ? [] : projects.filter(p => visible.has(p.id)).map(p => p.id)

  const onToggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]
    setVisibleProjects(next)
  }

  // Shortcuts: show only the projects in a category / owned by someone.
  const groups = (key: (p: typeof projects[0]) => string) => {
    const m = new Map<string, string[]>()
    for (const p of projects) { const k = key(p); m.set(k, [...(m.get(k) ?? []), p.id]) }
    return [...m.entries()]
  }
  const byCategory = groups(p => p.category)
  const byOwner = groups(p => p.owner)
  const isExactly = (ids: string[]) => !allVisible && ids.length === selected.length && ids.every(id => visible.has(id))

  const shortcutRow = (title: string, entries: [string, string[]][], label: (k: string) => string) => (
    <div className="px-1.5 py-1">
      <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#a1a1aa] mb-1">{title}</div>
      <div className="flex flex-wrap gap-1">
        {entries.map(([k, ids]) => {
          const on = isExactly(ids)
          return (
            <FilterShortcut key={k} active={on} onClick={() => setVisibleProjects(on ? [] : ids)}>
              {label(k)} <span className="opacity-60 tabular-nums">{ids.length}</span>
            </FilterShortcut>
          )
        })}
      </div>
    </div>
  )

  return (
    <FilterChip
      label={t('Projects')}
      options={projects.map(p => ({
        value: p.id,
        label: p.name,
        hint: resources.find(r => r.id === p.owner)?.name,
        color: p.color,
      }))}
      selected={selected}
      onToggle={onToggle}
      onSetAll={setVisibleProjects}
      header={byCategory.length > 1 || byOwner.length > 1 ? (
        <>
          {byCategory.length > 1 && shortcutRow(t('By category'), byCategory, k => t(k))}
          {byOwner.length > 1 && shortcutRow(t('By owner'), byOwner, k => resources.find(r => r.id === k)?.name ?? t('No owner'))}
        </>
      ) : undefined}
    />
  )
}
