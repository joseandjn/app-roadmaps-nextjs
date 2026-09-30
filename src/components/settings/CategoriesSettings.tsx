'use client'

import { useState } from 'react'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import { projectCategories } from '@/lib/roadmapUtils'
import { useTranslation } from '@/lib/i18n/useTranslation'

const inputCls = 'w-full text-[13px] text-[#27272a] bg-white border border-[#ececec] rounded-lg px-2.5 py-2 font-inherit'

// One category: rename in place (projects using it follow), or remove when
// no project uses it. Built-in names are shown translated.
function CategoryRow({ name, used, onlyOne }: { name: string; used: number; onlyOne: boolean }) {
  const { renameCategory, removeCategory } = useRoadmapStore()
  const { t } = useTranslation()
  const shown = t(name)
  const [value, setValue] = useState(shown)
  // Follow changes from elsewhere (undo, another tab, language switch),
  // adjusted during render rather than in an effect.
  const [synced, setSynced] = useState(shown)
  if (shown !== synced) { setSynced(shown); setValue(shown) }

  const commit = () => {
    const v = value.trim()
    if (!v || v === shown) { setValue(shown); return }
    renameCategory(name, v)
  }
  const blocked = used > 0 || onlyOne

  return (
    <div className="flex items-center gap-2 px-[9px] py-1.5 border border-[#f1f1f1] rounded-lg bg-white">
      <input
        className="flex-1 min-w-0 text-[13px] text-[#27272a] bg-transparent border-none outline-none font-inherit"
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur() }}
        aria-label={t('Category')}
      />
      <span className="text-[11px] text-[#a1a1aa] flex-none tabular-nums">{used === 1 ? t('1 project') : t('{n} projects', { n: used })}</span>
      <button
        onClick={() => removeCategory(name)}
        disabled={blocked}
        title={used > 0 ? t('Change the category of the projects that use it before deleting') : onlyOne ? t('At least one category is needed') : t('Remove')}
        className="text-[#a1a1aa] text-sm cursor-pointer border-none bg-transparent p-0 flex-none disabled:opacity-30 disabled:cursor-not-allowed"
      >
        ×
      </button>
    </div>
  )
}

export default function CategoriesSettings() {
  const { settings, projects, addCategory } = useRoadmapStore()
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const list = projectCategories(settings, projects)
  const count = (c: string) => projects.filter(p => p.category === c).length
  const submit = () => { if (name.trim()) { addCategory(name); setName('') } }

  return (
    <div>
      <div className="flex flex-col gap-1.5 mb-2">
        {list.map(c => <CategoryRow key={c} name={c} used={count(c)} onlyOne={list.length === 1} />)}
      </div>
      <div className="flex items-center gap-2">
        <input
          className={`${inputCls} flex-1 min-w-0`}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={t('New category name')}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
        />
        <button
          onClick={submit}
          disabled={!name.trim()}
          className="flex-none border border-[#ececec] text-[#52525b] bg-white rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer font-inherit disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t('Add')}
        </button>
      </div>
    </div>
  )
}
