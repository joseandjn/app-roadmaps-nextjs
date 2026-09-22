'use client'

import { useRoadmapStore } from '@/store/useRoadmapStore'
import { useTranslation } from '@/lib/i18n/useTranslation'

// Shown over a view when the filters leave nothing to draw, so an empty
// canvas never reads as "the plan is empty". Positioned against the view
// container in page.tsx (which is `relative`).
export default function FilterEmptyState() {
  const clearFilter = useRoadmapStore(s => s.clearFilter)
  const { t } = useTranslation()
  return (
    <div className="absolute inset-x-0 top-[140px] flex justify-center pointer-events-none z-30">
      <div className="pointer-events-auto bg-white border border-[#ececec] rounded-xl shadow-[0_8px_28px_rgba(0,0,0,0.08)] px-5 py-4 text-center">
        <div className="text-[13px] font-semibold text-[#27272a]">{t('No items match the filters')}</div>
        <button
          onClick={clearFilter}
          className="mt-2.5 text-[11px] font-semibold text-[#52525b] border border-[#ececec] rounded-lg px-2.5 py-1.5 bg-white cursor-pointer font-inherit hover:bg-[#f4f4f5]"
        >
          {t('Reset')}
        </button>
      </div>
    </div>
  )
}
