'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import { fetchCheckpoints, fetchCheckpoint, saveCheckpoint, deleteCheckpointAction, restoreCheckpointAction } from '@/lib/persistence/scenarioActions'
import ScenarioDiffPanel from '@/components/ScenarioDiffPanel'
import { fmtMoney, fmtDate, addDays, fmtSigned } from '@/lib/roadmapUtils'
import { useTranslation } from '@/lib/i18n/useTranslation'
import type { CheckpointMeta, ScenarioData } from '@/types'

const labelCls = 'text-[11px] font-semibold text-[#71717a] mb-1.5'
const inputCls = 'w-full text-[13px] text-[#27272a] bg-white border border-[#ececec] rounded-lg px-2.5 py-2 font-inherit'

export default function HistoryModal() {
  const {
    historyOpen, activeScenarioId, scenarios, settings, projects, items, resources, deps, sprints, roles,
    checkpointForm, toggleHistory, onNewCheckpoint, patchCheckpointForm, onCheckpointFormCancel, showToast,
  } = useRoadmapStore()
  const { t } = useTranslation()
  const [checkpoints, setCheckpoints] = useState<CheckpointMeta[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [diffId, setDiffId] = useState<string | null>(null)
  const [diffBase, setDiffBase] = useState<ScenarioData | null>(null)
  const current = useMemo<ScenarioData>(() => ({ projects, items, resources, deps, sprints, settings, roles }), [projects, items, resources, deps, sprints, settings, roles])

  const scenario = scenarios.find(s => s.id === activeScenarioId)
  const fm = (n: number) => fmtMoney(n, settings.currencySymbol)

  useEffect(() => {
    if (!historyOpen || !activeScenarioId) return
    let cancelled = false
    fetchCheckpoints(activeScenarioId).then(cs => { if (!cancelled) setCheckpoints(cs) })
    return () => { cancelled = true }
  }, [historyOpen, activeScenarioId])

  if (!historyOpen || !activeScenarioId) return null

  const save = async () => {
    if (!checkpointForm?.name.trim() || saving) return
    setSaving(true)
    const meta = await saveCheckpoint(activeScenarioId, checkpointForm.name.trim(), checkpointForm.note.trim())
    setSaving(false)
    onCheckpointFormCancel()
    if (meta) setCheckpoints(cs => [...(cs ?? []), meta])
  }

  const toggleDiff = async (cp: CheckpointMeta) => {
    if (diffId === cp.id) { setDiffId(null); setDiffBase(null); return }
    setDiffId(cp.id)
    setDiffBase(null)
    const full = await fetchCheckpoint(activeScenarioId, cp.id)
    setDiffBase(full?.snapshot ?? null)
  }

  const removeCheckpoint = async (id: string) => {
    await deleteCheckpointAction(activeScenarioId, id)
    setCheckpoints(cs => (cs ?? []).filter(c => c.id !== id))
  }

  const restore = async (cp: CheckpointMeta) => {
    const ok = await restoreCheckpointAction(activeScenarioId, cp.id)
    setConfirmingId(null)
    if (ok) {
      showToast(t('Restored "{name}"', { name: cp.name }))
      toggleHistory()
    }
  }

  const list = checkpoints ? [...checkpoints].reverse() : null

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[520px] max-h-[85vh] flex flex-col">
        <div className="px-5 pt-5 pb-4 border-b border-[#ececec] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#18181b]">{t('History')}</h2>
            {scenario && <p className="text-[11px] text-[#a1a1aa] mt-0.5">{scenario.name}</p>}
          </div>
          <button onClick={toggleHistory} className="text-[#a1a1aa] text-lg leading-none cursor-pointer border-none bg-transparent p-0">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
          {checkpointForm?.show ? (
            <div className="border border-[#ececec] rounded-xl p-3.5 flex flex-col gap-3">
              <div>
                <div className={labelCls}>{t('Name')}</div>
                <input
                  className={inputCls}
                  value={checkpointForm.name}
                  onChange={e => patchCheckpointForm({ name: e.target.value })}
                  placeholder={t('e.g. v2 — added QA')}
                  autoFocus
                />
              </div>
              <div>
                <div className={labelCls}>{t('Note (optional)')}</div>
                <textarea
                  className={`${inputCls} resize-none`}
                  rows={2}
                  value={checkpointForm.note}
                  onChange={e => patchCheckpointForm({ note: e.target.value })}
                  placeholder={t('What changed since the last checkpoint?')}
                />
              </div>
              <div className="flex gap-2">
                <button onClick={onCheckpointFormCancel} className="flex-1 border border-[#ececec] text-[#52525b] bg-white rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer font-inherit">
                  {t('Cancel')}
                </button>
                <button
                  onClick={save}
                  disabled={!checkpointForm.name.trim() || saving}
                  className="flex-1 bg-[#18181b] text-white border-none rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer font-inherit disabled:opacity-50"
                >
                  {saving ? t('Saving…') : t('Save checkpoint')}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={onNewCheckpoint}
              className="border border-dashed border-[#d4d4d8] text-[#52525b] rounded-xl px-3.5 py-2.5 text-xs font-semibold cursor-pointer font-inherit bg-white hover:bg-[#f4f4f5]"
            >
              + {t('Save checkpoint')}
            </button>
          )}

          {list === null && <p className="text-[13px] text-[#a1a1aa]">{t('Loading…')}</p>}
          {list?.length === 0 && <p className="text-[13px] text-[#a1a1aa]">{t('No checkpoints yet — save one to start tracking how this scenario evolves.')}</p>}

          {list?.map((cp, i) => {
            const prev = list[i + 1] // list is newest-first, so the previous checkpoint chronologically is the next entry
            const deltaCost = prev ? cp.metrics.totalCost - prev.metrics.totalCost : null
            const deltaEnd = prev && cp.metrics.endDay !== null && prev.metrics.endDay !== null ? cp.metrics.endDay - prev.metrics.endDay : null
            const confirming = confirmingId === cp.id
            return (
              <div key={cp.id} className="border border-[#f1f1f1] rounded-xl px-3.5 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-[#27272a] truncate">{cp.name}</div>
                    <div className="text-[11px] text-[#a1a1aa] mt-0.5">{fmtDate(new Date(cp.createdAt))}</div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-none">
                    {confirming ? (
                      <>
                        <button onClick={() => setConfirmingId(null)} className="text-[11px] font-semibold text-[#52525b] border border-[#ececec] rounded-md px-2 py-1 bg-white cursor-pointer">{t('Cancel')}</button>
                        <button onClick={() => restore(cp)} className="text-[11px] font-semibold text-white bg-[#c0584f] border-none rounded-md px-2 py-1 cursor-pointer">{t('Confirm restore')}</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => toggleDiff(cp)} className="text-[11px] font-semibold text-[#52525b] border border-[#ececec] rounded-md px-2 py-1 bg-white cursor-pointer hover:bg-[#f4f4f5]">{diffId === cp.id ? t('Hide changes') : t('Compare with current')}</button>
                        <button onClick={() => setConfirmingId(cp.id)} className="text-[11px] font-semibold text-[#52525b] border border-[#ececec] rounded-md px-2 py-1 bg-white cursor-pointer hover:bg-[#f4f4f5]">{t('Restore')}</button>
                        <button onClick={() => removeCheckpoint(cp.id)} className="text-[#a1a1aa] text-sm cursor-pointer border-none bg-transparent p-0 px-1">×</button>
                      </>
                    )}
                  </div>
                </div>
                {cp.note && <p className="text-[12px] text-[#71717a] mt-1.5">{cp.note}</p>}
                <div className="flex items-center gap-3 mt-2 text-[11px]">
                  <span className="font-semibold text-[#27272a]">{fm(cp.metrics.totalCost)}</span>
                  {deltaCost !== null && deltaCost !== 0 && (
                    <span style={{ color: deltaCost > 0 ? '#9a5b00' : '#1f7a3d' }}>{fmtSigned(deltaCost, fm)} {t('vs {name}', { name: prev!.name })}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-[11px]">
                  <span className="text-[#52525b]">{cp.metrics.endDay !== null ? fmtDate(addDays(cp.metrics.endDay)) : '—'}</span>
                  {deltaEnd !== null && deltaEnd !== 0 && (
                    <span style={{ color: deltaEnd > 0 ? '#9a5b00' : '#1f7a3d' }}>{fmtSigned(deltaEnd, n => t('{n}d', { n }))} {t('vs {name}', { name: prev!.name })}</span>
                  )}
                </div>
                {diffId === cp.id && (
                  <div className="mt-3 pt-3 border-t border-[#f1f1f1]">
                    {diffBase ? <ScenarioDiffPanel base={diffBase} target={current} /> : <p className="text-[12px] text-[#a1a1aa]">{t('Loading…')}</p>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
