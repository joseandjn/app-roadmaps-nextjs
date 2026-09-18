'use client'

import { useRoadmapStore } from '@/store/useRoadmapStore'

export default function Toast() {
  const toast = useRoadmapStore(s => s.toast)

  if (!toast?.show) return null

  return (
    <div
      className="absolute bottom-[18px] left-1/2 -translate-x-1/2 bg-[#18181b] text-white text-xs font-medium px-[15px] py-[9px] rounded-[9px] z-[45] whitespace-nowrap pointer-events-none"
      style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.18)', animation: 'popIn .18s ease' }}
    >
      {toast.text}
    </div>
  )
}
