'use client'

import { useRoadmapStore } from '@/store/useRoadmapStore'
import { initials, allocColor, resPeak, roleMismatch, fmtDate, addDays, dateStr, workingDaysInRange, itemEnd, resourceCapacity, utilizationPct, isOverloaded } from '@/lib/roadmapUtils'
import { STATUS_ORDER, ITEM_TYPES } from '@/data/initialData'
import { roleIconDef } from '@/data/roleIcons'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useFilterContext } from '@/lib/useFilterContext'
import { itemsForMetrics, colorLoad } from '@/lib/filters'

const labelCls = 'text-[11px] font-semibold text-[#71717a] mb-1.5'
const inputCls = 'w-full text-[13px] text-[#27272a] bg-white border border-[#ececec] rounded-lg px-2.5 py-2 font-inherit'

export default function RightPanel() {
  const {
    panel, draft, draftOrig, resSel, cell,
    resources, items, projects, deps, settings, roles, filterStartDay,
    clearPanel, onDraftTitle, onDraftStatus, onDraftType, onAddDraftRequiredRole, onRemoveDraftRequiredRole, onDraftStart, onDraftEnd,
    onAddAssignee, setAssignPct, removeAssign, onAddDep, removeDep,
    onSaveItem, onDeleteItem, editResource, setFilters,
  } = useRoadmapStore()
  const { t } = useTranslation()
  const fctx = useFilterContext()
  const workDays = draft ? workingDaysInRange(draft.startDay, draft.dur, settings) : 0

  const open = panel === 'item' || panel === 'cell' || panel === 'res'

  return (
    <div
      className="absolute top-0 right-0 bottom-0 w-[350px] max-w-[88vw] bg-white border-l border-[#ececec] flex flex-col z-40"
      style={{
        boxShadow: open ? '-8px 0 28px rgba(0,0,0,0.06)' : 'none',
        transform: open ? 'translateX(0)' : 'translateX(110%)',
        transition: 'transform .3s cubic-bezier(.4,0,.2,1)',
      }}
    >
      {/* Item panel */}
      {panel === 'item' && draft && (
        <>
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#ececec]">
            <h2 className="text-sm font-semibold text-[#18181b]">{draft._new ? t('New item') : t('Edit item')}</h2>
            <button onClick={clearPanel} className="text-[#a1a1aa] text-lg leading-none cursor-pointer border-none bg-transparent p-0">×</button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
            <div>
              <div className={labelCls}>{t('Title')}</div>
              <input className={inputCls} value={draft.title} onChange={e => onDraftTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className={labelCls}>{t('Status')}</div>
                <select className={inputCls} value={draft.status} onChange={e => onDraftStatus(e.target.value)}>
                  {STATUS_ORDER.map(s => <option key={s} value={s}>{t(s)}</option>)}
                </select>
              </div>
              <div>
                <div className={labelCls}>{t('Type')}</div>
                <select className={inputCls} value={draft.type} onChange={e => onDraftType(e.target.value)}>
                  {ITEM_TYPES.map(ty => <option key={ty} value={ty}>{t(ty.charAt(0).toUpperCase() + ty.slice(1))}</option>)}
                </select>
              </div>
            </div>
            <div>
              <div className={labelCls}>{t('Required roles')}</div>
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                {(draft.requiredRoles ?? []).map(roleName => {
                  const { Icon } = roleIconDef(roles.find(r => r.name === roleName)?.icon)
                  return (
                    <div key={roleName} className="flex items-center gap-1 pl-1 pr-1.5 py-1 border border-[#ececec] rounded-full bg-[#f4f4f5]">
                      <div className="w-4 h-4 rounded-full bg-white flex items-center justify-center flex-none">
                        <Icon size={10} className="text-[#52525b]" />
                      </div>
                      <span className="text-[12px] text-[#27272a]">{t(roleName)}</span>
                      <button onClick={() => onRemoveDraftRequiredRole(roleName)} className="text-[#a1a1aa] text-xs leading-none cursor-pointer border-none bg-transparent p-0 ml-0.5">×</button>
                    </div>
                  )
                })}
                {(draft.requiredRoles ?? []).length === 0 && <span className="text-[12px] text-[#a1a1aa] py-1">{t('Any role')}</span>}
              </div>
              <select className={inputCls} onChange={e => { if (e.target.value) onAddDraftRequiredRole(e.target.value); e.target.value = '' }} defaultValue="">
                <option value="" disabled>{t('Add role…')}</option>
                {roles.filter(role => !draft.requiredRoles?.includes(role.name)).map(role => (
                  <option key={role.name} value={role.name}>{t(role.name)}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className={labelCls}>{t('Start')}</div>
                <input type="date" className={inputCls} value={dateStr(draft.startDay)} onChange={e => onDraftStart(e.target.value)} />
              </div>
              <div>
                <div className={labelCls}>{draft.type === 'milestone' || draft.type === 'release' ? t('Date') : t('End')}</div>
                {draft.type !== 'milestone' && draft.type !== 'release' && (
                  <input type="date" className={inputCls} value={dateStr(draft.startDay + draft.dur)} onChange={e => onDraftEnd(e.target.value)} />
                )}
              </div>
            </div>
            {draft.type !== 'milestone' && draft.type !== 'release' && (
              <div className="text-[11px] text-[#a1a1aa] -mt-2.5">
                {t('{n} working days', { n: workDays })}
                {draft.assignments.length > 0 && ` · ${t('{n}h total', { n: Math.round(draft.assignments.reduce((sum, a) => sum + workDays * settings.workHoursPerDay * a.pct / 100, 0)) })}`}
              </div>
            )}

            {/* Assignees */}
            <div>
              <div className={labelCls}>{t('Assignees')}</div>
              <div className="flex flex-col gap-2 mb-2">
                {draft.assignments.map(a => {
                  const r = resources.find(r => r.id === a.r)!
                  const hours = Math.round(workDays * settings.workHoursPerDay * a.pct / 100)
                  const cap = resourceCapacity(r)
                  const mismatch = roleMismatch(draft, r)
                  return (
                    <div key={a.r} className="flex items-center gap-2">
                      <div className="w-[26px] h-[26px] rounded-[8px] bg-[#ececef] text-[#52525b] text-[10px] font-semibold flex items-center justify-center flex-none">{initials(r.name)}</div>
                      <span className="text-[13px] text-[#27272a] flex-1 truncate">
                        {r.name}
                        {cap < 100 && <span className="text-[10px] text-[#a1a1aa] ml-1.5">{t('avail. {n}%', { n: cap })}</span>}
                        {mismatch && (
                          <span className="text-[10px] text-[#9a5b00] ml-1.5" title={t('{role} does not match the required role', { role: t(r.role) })}>
                            {t('wrong role')}
                          </span>
                        )}
                      </span>
                      <input type="number" min={0} max={200} value={a.pct} onChange={e => setAssignPct(a.r, +e.target.value)}
                        style={a.pct > cap ? { borderColor: '#e0902a', color: '#9a5b00' } : undefined}
                        className="w-14 text-[12px] text-center border border-[#ececec] rounded-lg px-1 py-1 font-inherit" />
                      <span className="text-[11px] text-[#a1a1aa]">%</span>
                      <span className="text-[11px] text-[#a1a1aa] w-9 text-right tabular-nums">{hours}h</span>
                      <button onClick={() => removeAssign(a.r)} className="text-[#a1a1aa] text-sm cursor-pointer border-none bg-transparent p-0">×</button>
                    </div>
                  )
                })}
              </div>
              <select className={inputCls} onChange={e => { onAddAssignee(e.target.value); e.target.value = '' }} defaultValue="">
                <option value="" disabled>{t('Add assignee…')}</option>
                {resources.filter(r => !draft.assignments.some(a => a.r === r.id)).map(r => (
                  <option key={r.id} value={r.id}>{r.name}{roleMismatch(draft, r) ? ` — ${t(r.role)} ⚠` : ''}</option>
                ))}
              </select>
            </div>

            {/* Dependencies */}
            <div>
              <div className={labelCls}>{t('Depends on')}</div>
              <div className="flex flex-col gap-1.5 mb-2">
                {(draft._deps ?? []).map(tid => {
                  const it = items.find(i => i.id === tid)
                  const pr = it ? projects.find(p => p.id === it.projectId) : null
                  const clash = it ? itemEnd(it) > draft.startDay : false
                  return (
                    <div key={tid} className="flex items-center gap-2 px-[9px] py-1.5 border border-[#f1f1f1] rounded-lg">
                      <span className="w-[7px] h-[7px] rounded-[2px] flex-none" style={{ background: pr?.color ?? '#a1a1aa' }} />
                      <span className="text-[12px] text-[#27272a] flex-1 truncate">{it?.title ?? '?'}{pr ? ` · ${pr.name.split(' — ')[0]}` : ''}</span>
                      {clash && <span className="text-[10px] text-[#9a5b00] font-semibold">{t('Clash')}</span>}
                      <button onClick={() => removeDep(tid)} className="text-[#a1a1aa] text-sm cursor-pointer border-none bg-transparent p-0">×</button>
                    </div>
                  )
                })}
              </div>
              <select className={inputCls} onChange={e => { onAddDep(e.target.value); e.target.value = '' }} defaultValue="">
                <option value="" disabled>{t('Add dependency…')}</option>
                {items.filter(it => it.id !== draft.id && !draft._deps?.includes(it.id)).map(it => {
                  const pr = projects.find(p => p.id === it.projectId)
                  return <option key={it.id} value={it.id}>{it.title} — {pr?.name.split(' — ')[0]}</option>
                })}
              </select>
              {draftOrig && (
                <button
                  onClick={() => setFilters({ focusItemId: draft.id })}
                  className="mt-2 text-[11px] font-semibold text-[#3b6ef5] bg-transparent border-none cursor-pointer font-inherit p-0 hover:underline"
                >
                  {t('Show dependency path')}
                </button>
              )}
            </div>
          </div>
          <div className="px-4 py-3.5 border-t border-[#ececec] flex gap-2">
            {draftOrig && (
              <button onClick={onDeleteItem} className="border border-[#f0d9d6] text-[#c0584f] bg-white rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer font-inherit">
                {t('Delete')}
              </button>
            )}
            <button onClick={clearPanel} className="flex-1 border border-[#ececec] text-[#52525b] bg-white rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer font-inherit">
              {t('Cancel')}
            </button>
            <button onClick={onSaveItem} className="flex-1 bg-[#18181b] text-white border-none rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer font-inherit">
              {draft._new ? t('Create') : t('Save changes')}
            </button>
          </div>
        </>
      )}

      {/* Resource detail panel */}
      {panel === 'res' && resSel && (() => {
        const r = resources.find(res => res.id === resSel)!
        const counted = itemsForMetrics(items, fctx)
        const peak = resPeak(resSel, counted)
        const fullPeak = resPeak(resSel, items)
        const util = utilizationPct(colorLoad(peak, fullPeak, r), r)
        const col = allocColor(util)
        const over = isOverloaded(fullPeak, r)
        const capacity = resourceCapacity(r)
        const byProj: Record<string, { it: typeof items[0]; pct: number }[]> = {}
        for (const it of counted) {
          if (it.dur <= 0) continue
          for (const as of it.assignments) {
            if (as.r === resSel) { (byProj[it.projectId] = byProj[it.projectId] ?? []).push({ it, pct: as.pct }) }
          }
        }
        const tag = fullPeak <= 0 ? t('Free') : util < 85 ? t('Available') : util <= 100 ? t('Full') : t('Overallocated')

        return (
          <>
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#ececec]">
              <h2 className="text-sm font-semibold text-[#18181b]">{t('Resource')}</h2>
              <div className="flex items-center gap-3">
                <button onClick={() => editResource(resSel)} className="text-[11px] font-semibold text-[#52525b] border border-[#ececec] rounded-md px-2 py-1 bg-white cursor-pointer">{t('Edit')}</button>
                <button onClick={clearPanel} className="text-[#a1a1aa] text-lg leading-none cursor-pointer border-none bg-transparent p-0">×</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-[34px] h-[34px] rounded-[10px] bg-[#ececef] text-[#52525b] text-xs font-semibold flex items-center justify-center flex-none">{initials(r.name)}</div>
                <div>
                  <div className="text-sm font-semibold text-[#27272a]">{r.name}</div>
                  <div className="text-[11px] text-[#a1a1aa]">{t(r.role)}</div>
                </div>
                <span className="ml-auto text-[11px] font-semibold px-2 py-1 rounded-md" style={{ background: col.bg, color: col.fg, border: `1px solid ${col.bd}` }}>{tag}</span>
              </div>

              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-[26px] font-bold tracking-tight" style={{ color: over ? '#9a5b00' : '#27272a' }}>{peak}%</span>
                <span className="text-xs text-[#a1a1aa]">{t('peak allocation')}{capacity < 100 && ` · ${t('availability {n}%', { n: capacity })}`}</span>
              </div>
              {fullPeak !== peak && (
                <div className="text-[11px] text-[#71717a] mb-1">{t('Total peak {n}% including items outside the filters', { n: fullPeak })}</div>
              )}
              <div className="h-1.5 bg-[#f4f4f5] rounded-full mb-5">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, util)}%`, background: over ? '#e0902a' : '#3b6ef5' }} />
              </div>

              {Object.keys(byProj).map(pid => {
                const p = projects.find(pr => pr.id === pid)!
                const list = byProj[pid].sort((a, b) => a.it.startDay - b.it.startDay)
                const tot = list.reduce((s, x) => s + x.pct, 0)
                return (
                  <div key={pid} className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-[3px] flex-none" style={{ background: p?.color }} />
                      <span className="text-[12px] font-semibold text-[#27272a] flex-1 truncate">{p?.name}</span>
                      <span className="text-[11px] text-[#a1a1aa]">{tot}%</span>
                    </div>
                    {list.map(({ it, pct }) => (
                      <div key={it.id} className="flex items-center gap-2 py-1 ml-4 text-[12px] text-[#52525b]">
                        <span className="flex-1 truncate">{it.title}</span>
                        <span className="text-[11px] text-[#a1a1aa]">{pct}%</span>
                        <span className="text-[11px] text-[#a1a1aa]">{fmtDate(addDays(it.startDay))}</span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </>
        )
      })()}

      {/* Cell detail panel */}
      {panel === 'cell' && cell && (() => {
        const r = resources.find(res => res.id === cell.rid)!
        const b = cell.bucket
        // Buckets are relative to the start of the date range, same as ResourcesView.
        const absS = Math.max(0, filterStartDay ?? 0) + b.s
        const absE = absS + b.d
        const counted = new Set(itemsForMetrics(items, fctx).map(i => i.id))
        let total = 0
        let full = 0
        const cellItems: { title: string; project: string; pct: number; color: string }[] = []
        for (const it of items) {
          if (it.dur <= 0) continue
          if (it.startDay >= absE || it.startDay + it.dur <= absS) continue
          for (const as of it.assignments) {
            if (as.r !== cell.rid) continue
            full += as.pct
            if (counted.has(it.id)) {
              total += as.pct
              const pr = projects.find(p => p.id === it.projectId)
              cellItems.push({ title: it.title, project: pr?.name ?? '', pct: as.pct, color: pr?.color ?? '#a1a1aa' })
            }
          }
        }
        const util = utilizationPct(colorLoad(total, full, r), r)
        const col = allocColor(util)
        const over = isOverloaded(full, r)
        const tag = full <= 0 ? t('Free') : util < 85 ? t('Available') : util <= 100 ? t('Full') : t('Overallocated')

        return (
          <>
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#ececec]">
              <h2 className="text-sm font-semibold text-[#18181b]">{r.name} — {b.label}</h2>
              <button onClick={clearPanel} className="text-[#a1a1aa] text-lg leading-none cursor-pointer border-none bg-transparent p-0">×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-[28px] font-bold tracking-tight" style={{ color: over ? '#9a5b00' : '#27272a' }}>{total}%</span>
                <span className="ml-auto text-[11px] font-semibold px-2 py-1 rounded-md" style={{ background: col.bg, color: col.fg, border: `1px solid ${col.bd}` }}>{tag}</span>
              </div>
              {full !== total && (
                <div className="text-[11px] text-[#71717a]">{t('Total load {full}% ({n}% outside the filters)', { full, n: full - total })}</div>
              )}
              <div className="flex flex-col gap-2 mt-4">
                {cellItems.map((ci, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5 px-2.5 border border-[#f1f1f1] rounded-lg">
                    <span className="w-2 h-2 rounded-[2px] flex-none" style={{ background: ci.color }} />
                    <span className="text-[12px] text-[#27272a] flex-1 truncate">{ci.title}</span>
                    <span className="text-[11px] text-[#52525b] truncate">{ci.project.split(' — ')[0]}</span>
                    <span className="text-[12px] font-semibold text-[#27272a] tabular-nums">{ci.pct}%</span>
                  </div>
                ))}
                {cellItems.length === 0 && <p className="text-[13px] text-[#a1a1aa]">{t('No assignments in this period.')}</p>}
              </div>
            </div>
          </>
        )
      })()}
    </div>
  )
}
