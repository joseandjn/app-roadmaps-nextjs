'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { dateStr } from '@/lib/roadmapUtils'
import { getTodayDay } from '@/data/initialData'

const labelCls = 'text-[11px] font-semibold text-[#71717a] mb-1.5'
const btnCls = 'flex-1 text-center border border-[#ececec] text-[#52525b] bg-white rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer font-inherit no-underline'

// Downloads the estimation knowledge base (/api/knowledge): the official
// scenario's finished tasks with their estimates, actual duration and
// dependencies, as JSONL (for tools) or Markdown (to read or paste in a chat).
export default function KnowledgeSettings() {
  const { t, locale } = useTranslation()
  const [includeUnestimated, setIncludeUnestimated] = useState(false)
  const [count, setCount] = useState<number | null>(null)

  const query = includeUnestimated ? '&includeUnestimated=1' : ''
  useEffect(() => {
    let live = true
    fetch(`/api/knowledge?format=jsonl${query}`, { method: 'HEAD' })
      .then(r => { if (live && r.ok) setCount(Number(r.headers.get('X-Record-Count') ?? 0)) })
      .catch(() => {})
    return () => { live = false }
  }, [query])

  const stamp = dateStr(getTodayDay())
  return (
    <div>
      <div className={labelCls}>{t('Estimation knowledge base')}</div>
      <p className="text-[12px] text-[#71717a] mb-3 leading-snug">
        {t('Finished tasks of the official scenario with their description, estimates, actual duration and dependencies.')}
        {count !== null && <> {t('{n} tasks right now.', { n: count })}</>}
      </p>
      <label className="flex items-center gap-1.5 text-[12px] text-[#52525b] cursor-pointer mb-3">
        <input type="checkbox" checked={includeUnestimated} onChange={e => setIncludeUnestimated(e.target.checked)} />
        {t('Include tasks without an estimate')}
      </label>
      <div className="flex gap-2">
        <a className={btnCls} href={`/api/knowledge?format=jsonl${query}`} download={`knowledge-${stamp}.jsonl`}>{t('Download JSONL')}</a>
        <a className={btnCls} href={`/api/knowledge?format=md&lang=${locale}${query}`} download={`knowledge-${stamp}.md`}>{t('Download Markdown')}</a>
      </div>
    </div>
  )
}
