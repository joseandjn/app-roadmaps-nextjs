'use client'

import { useRoadmapStore } from '@/store/useRoadmapStore'
import { resPeak, initials, allocColor } from '@/lib/roadmapUtils'
import { STATUS_CONFIG, STATUS_ORDER } from '@/data/initialData'
import { useTranslation } from '@/lib/i18n/useTranslation'

export default function LeftRail() {
  const {
    view, projects, items, resources, visible, railOpen,
    toggleRail, toggleProject, editProject, newItem, openRes,
    onNewResource, panel, resSel,
  } = useRoadmapStore()
  const { t } = useTranslation()

  const isResources = view === 'resources'
  const isCross = view === 'cross'
  const visCount = projects.filter(p => visible.has(p.id)).length

  if (!railOpen) {
    return (
      <button
        onClick={toggleRail}
        title={t('Show sidebar')}
        className="w-7 h-full border-r border-[#ececec] bg-[#fcfcfd] text-[#71717a] text-xs flex items-center justify-center cursor-pointer flex-none"
        style={{ writingMode: 'vertical-lr' }}
      >
        ❯
      </button>
    )
  }

  return (
    <aside className="w-[264px] flex-none border-r border-[#ececec] flex flex-col min-h-0 bg-[#fcfcfd] overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-3.5 pb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#a1a1aa] whitespace-nowrap">
            {isResources ? t('Resources') : isCross ? t('Projects overlaid') : t('Projects')}
          </span>
          <span className="text-[11px] text-[#a1a1aa] whitespace-nowrap">
            {isResources ? t('{n} people', { n: resources.length }) : `${visCount}/${projects.length}`}
          </span>
        </div>
        <button
          onClick={toggleRail}
          title={t('Hide sidebar')}
          className="flex-none w-6 h-6 border border-[#ececec] bg-white rounded-[7px] cursor-pointer text-[#71717a] text-[13px] flex items-center justify-center p-0"
        >
          ❮
        </button>
      </div>

      {/* Resources rail */}
      {isResources ? (
        <>
          <div className="flex-1 overflow-y-auto px-2 pb-3">
            {resources.map(r => {
              const peak = resPeak(r.id, items)
              const col = allocColor(peak)
              const over = peak > 100
              const sel = resSel === r.id && panel === 'res'
              return (
                <div
                  key={r.id}
                  onClick={() => openRes(r.id)}
                  className="flex items-center gap-2.5 px-2 py-2.5 rounded-lg cursor-pointer"
                  style={{ background: sel ? '#f1f5fd' : 'transparent' }}
                >
                  <div className="w-[30px] h-[30px] rounded-[9px] bg-[#ececef] text-[#52525b] text-[11px] font-semibold flex items-center justify-center flex-none">
                    {initials(r.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-[#27272a] truncate">{r.name}</div>
                    <div className="text-[11px] text-[#a1a1aa]">{t(r.role)}</div>
                  </div>
                  <span className="text-xs font-semibold tabular-nums" style={{ color: over ? '#9a5b00' : '#a1a1aa' }}>
                    {peak}%
                  </span>
                </div>
              )
            })}
          </div>
          <div className="border-t border-[#ececec] px-3.5 py-2.5 flex items-center gap-3">
            {[['Available', '#bcd2f7'], ['Full', '#eecfa3']].map(([l, c]) => (
              <div key={l} className="flex items-center gap-1.5 text-[11px] text-[#71717a]">
                <span className="w-2 h-2 rounded-[3px] flex-none" style={{ background: c }} />
                {t(l)}
              </div>
            ))}
            <button
              onClick={onNewResource}
              className="ml-auto text-[11px] font-semibold text-[#52525b] border border-[#ececec] rounded-md px-2 py-1 bg-white cursor-pointer"
            >
              {t('+ Add')}
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Project list */}
          <div className="flex-1 overflow-y-auto px-2 pb-3">
            {projects.map(p => {
              const vis = visible.has(p.id)
              const owner = resources.find(r => r.id === p.owner)
              const cnt = items.filter(i => i.projectId === p.id).length
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-[9px] px-2 py-[9px] rounded-[9px]"
                  style={{ opacity: vis ? 1 : 0.55 }}
                >
                  <button
                    onClick={() => toggleProject(p.id)}
                    className="flex-none w-3.5 h-3.5 rounded p-0 cursor-pointer"
                    style={{
                      border: `1.5px solid ${vis ? p.color : '#d4d4d8'}`,
                      background: vis ? p.color : '#fff',
                    }}
                  />
                  <div onClick={() => editProject(p.id)} className="flex-1 min-w-0 cursor-pointer">
                    <div className="flex items-center gap-[7px]">
                      <span className="w-2 h-2 rounded-[3px] flex-none" style={{ background: p.color, opacity: vis ? 1 : 0.4 }} />
                      <span className="text-[13px] font-semibold text-[#27272a] truncate">{p.name}</span>
                    </div>
                    <div className="text-[11px] text-[#a1a1aa] ml-[15px] mt-0.5 truncate">
                      {owner?.name} · {t('{n} items', { n: cnt })}
                    </div>
                  </div>
                  <button
                    onClick={() => newItem(p.id)}
                    className="flex-none w-[22px] h-[22px] border-none bg-transparent text-[#a1a1aa] cursor-pointer rounded-[5px] text-[15px] leading-none"
                    title={t('Add item')}
                  >
                    +
                  </button>
                </div>
              )
            })}
          </div>

          {/* Status legend */}
          <div className="border-t border-[#ececec] px-3.5 py-2.5 flex flex-wrap gap-x-3 gap-y-1.5">
            {STATUS_ORDER.map(s => (
              <div key={s} className="inline-flex items-center gap-1.5 text-[11px] text-[#71717a]">
                <span className="w-2 h-2 rounded-[2px] flex-none" style={{ background: STATUS_CONFIG[s].dot }} />
                {t(s)}
              </div>
            ))}
          </div>
        </>
      )}
    </aside>
  )
}
