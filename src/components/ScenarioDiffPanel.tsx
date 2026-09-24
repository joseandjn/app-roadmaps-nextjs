'use client'

import { useMemo } from 'react'
import { diffScenarios, type ItemDiff, type ResourceDiff } from '@/lib/scenarioDiff'
import { fmtMoney, fmtDate, addDays, fmtSigned, isInstantItem, resourceCapacity, sameTimeOff } from '@/lib/roadmapUtils'
import { useTranslation } from '@/lib/i18n/useTranslation'
import type { Item, ScenarioData } from '@/types'

const CHIP = {
  added: 'bg-[#ecf6ef] text-[#1f7a3d] border-[#cde7d4]',
  removed: 'bg-[#fdeceb] text-[#c0584f] border-[#f1c0bc]',
  changed: 'bg-[#fdf1e3] text-[#9a5b00] border-[#f1d3a8]',
} as const

const UP = '#9a5b00'
const DOWN = '#1f7a3d'

export default function ScenarioDiffPanel({ base, target }: { base: ScenarioData; target: ScenarioData }) {
  const { t } = useTranslation()
  const diff = useMemo(() => diffScenarios(base, target), [base, target])
  const fm = (n: number) => fmtMoney(n, target.settings.currencySymbol)
  const days = (n: number) => t('{n}d', { n })

  const resName = (rid: string) => target.resources.find(r => r.id === rid)?.name ?? base.resources.find(r => r.id === rid)?.name ?? '?'
  const projName = (pid: string) => target.projects.find(p => p.id === pid)?.name ?? base.projects.find(p => p.id === pid)?.name ?? '?'
  const chipLabel = (k: keyof typeof CHIP) => t(k === 'added' ? 'Added' : k === 'removed' ? 'Removed' : 'Modified')
  const when = (it: Item) => isInstantItem(it)
    ? fmtDate(addDays(it.startDay))
    : `${fmtDate(addDays(it.startDay))} – ${fmtDate(addDays(it.startDay + it.dur))}`

  const describeItem = (d: ItemDiff): string[] => {
    const lines: string[] = []
    if (d.kind === 'added' && d.after) {
      lines.push(when(d.after))
      for (const a of d.after.assignments) lines.push(`${resName(a.r)} ${a.pct}%`)
      return lines
    }
    if (d.kind === 'removed' && d.before) {
      lines.push(when(d.before))
      for (const a of d.before.assignments) lines.push(`${resName(a.r)} ${a.pct}%`)
      return lines
    }
    const { before, after } = d
    if (!before || !after) return lines
    if (d.fields.includes('title')) lines.push(t('Renamed from "{name}"', { name: before.title }))
    if (d.fields.includes('project')) lines.push(t('Project: {from} → {to}', { from: projName(before.projectId), to: projName(after.projectId) }))
    if (d.fields.includes('status')) lines.push(t('Status: {from} → {to}', { from: t(before.status), to: t(after.status) }))
    if (d.fields.includes('type')) lines.push(t('Type: {from} → {to}', { from: t(before.type.charAt(0).toUpperCase() + before.type.slice(1)), to: t(after.type.charAt(0).toUpperCase() + after.type.slice(1)) }))
    if (d.startShift !== 0 && d.startShift === d.endShift) {
      lines.push(t('Moved {n}', { n: fmtSigned(d.startShift, days) }))
    } else {
      if (d.startShift !== 0) lines.push(t('Start: {from} → {to}', { from: fmtDate(addDays(before.startDay)), to: fmtDate(addDays(after.startDay)) }))
      if (d.endShift !== 0) lines.push(t('End: {from} → {to}', { from: fmtDate(addDays(before.startDay + before.dur)), to: fmtDate(addDays(after.startDay + after.dur)) }))
    }
    for (const a of d.assignments) {
      if (a.from === null) lines.push(`+ ${resName(a.rid)} ${a.to}%`)
      else if (a.to === null) lines.push(`− ${resName(a.rid)} ${a.from}%`)
      else lines.push(`${resName(a.rid)} ${a.from}% → ${a.to}%`)
    }
    if (lines.length === 0) lines.push(t('Cost changed (rate or settings)'))
    return lines
  }

  const describeResource = (d: ResourceDiff): string[] => {
    const lines: string[] = []
    const { before, after } = d
    if (before && after) {
      const unit = (u: string) => (u === 'hour' ? t('/hr') : t('/mo'))
      if (before.name !== after.name) lines.push(t('Name: {from} → {to}', { from: before.name, to: after.name }))
      if (before.role !== after.role) lines.push(t('Role: {from} → {to}', { from: t(before.role), to: t(after.role) }))
      if (before.cost !== after.cost || before.costUnit !== after.costUnit) {
        lines.push(t('Rate: {from} → {to}', { from: `${fm(before.cost)}${unit(before.costUnit)}`, to: `${fm(after.cost)}${unit(after.costUnit)}` }))
      }
      if (resourceCapacity(before) !== resourceCapacity(after)) {
        lines.push(t('Availability: {from} → {to}', { from: `${resourceCapacity(before)}%`, to: `${resourceCapacity(after)}%` }))
      }
      if (!sameTimeOff(before.timeOff, after.timeOff)) {
        const days = (r: typeof before) => (r.timeOff ?? []).reduce((n, o) => n + o.dur, 0)
        lines.push(t('Time off: {from} → {to} days', { from: days(before), to: days(after) }))
      }
    } else if (after) {
      lines.push(`${t(after.role)} · ${fm(after.cost)}${after.costUnit === 'hour' ? t('/hr') : t('/mo')}${resourceCapacity(after) < 100 ? ` · ${resourceCapacity(after)}%` : ''}`)
    } else if (before) {
      lines.push(`${t(before.role)} · ${fm(before.cost)}${before.costUnit === 'hour' ? t('/hr') : t('/mo')}`)
    }
    return lines
  }

  const { before: mb, after: ma } = diff
  const dCost = ma.totalCost - mb.totalCost
  const dEnd = mb.endDay !== null && ma.endDay !== null ? ma.endDay - mb.endDay : null
  const dOver = ma.overallocated - mb.overallocated
  const dPeople = ma.headcount - mb.headcount
  const dItems = ma.itemCount - mb.itemCount
  const tone = (n: number) => (n > 0 ? UP : n < 0 ? DOWN : '#a1a1aa')

  const stat = (label: string, from: string, to: string, delta: string | null, color: string) => (
    <div className="flex items-baseline gap-2 text-[12px]">
      <span className="w-[110px] flex-none text-[#71717a]">{label}</span>
      <span className="text-[#52525b] tabular-nums">{from} → {to}</span>
      {delta && <span className="font-semibold tabular-nums" style={{ color }}>{delta}</span>}
    </div>
  )

  const costTag = (before: number, after: number) => {
    const d = after - before
    if (Math.abs(d) < 0.5) return null
    return <span className="text-[12px] font-semibold tabular-nums flex-none" style={{ color: tone(d) }}>{fmtSigned(d, fm)}</span>
  }

  const row = (key: string, kind: keyof typeof CHIP, title: string, sub: string | null, lines: string[], tag: React.ReactNode) => (
    <div key={key} className="border border-[#f1f1f1] rounded-lg px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className={`flex-none text-[9px] font-semibold uppercase tracking-[0.04em] border rounded-full px-1.5 py-0.5 ${CHIP[kind]}`}>{chipLabel(kind)}</span>
        <span className="text-[13px] font-semibold text-[#27272a] truncate flex-1">{title}</span>
        {tag}
      </div>
      {sub && <div className="text-[11px] text-[#a1a1aa] mt-0.5">{sub}</div>}
      {lines.length > 0 && (
        <ul className="mt-1.5 flex flex-col gap-0.5">
          {lines.map((l, i) => <li key={i} className="text-[12px] text-[#52525b]">{l}</li>)}
        </ul>
      )}
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        {stat(t('Total cost'), fm(mb.totalCost), fm(ma.totalCost), dCost === 0 ? null : fmtSigned(dCost, fm), tone(dCost))}
        {stat(t('End date'), mb.endDay !== null ? fmtDate(addDays(mb.endDay)) : '—', ma.endDay !== null ? fmtDate(addDays(ma.endDay)) : '—', dEnd ? fmtSigned(dEnd, days) : null, tone(dEnd ?? 0))}
        {stat(t('Overallocated'), String(mb.overallocated), String(ma.overallocated), dOver === 0 ? null : fmtSigned(dOver, String), tone(dOver))}
        {stat(t('People'), String(mb.headcount), String(ma.headcount), dPeople === 0 ? null : fmtSigned(dPeople, String), '#71717a')}
        {stat(t('Items'), String(mb.itemCount), String(ma.itemCount), dItems === 0 ? null : fmtSigned(dItems, String), '#71717a')}
      </div>

      {diff.resources.length > 0 && (
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#a1a1aa] mb-2">{t('Changes in people')}</h4>
          <div className="flex flex-col gap-2">
            {diff.resources.map(d => row(
              d.id, d.kind, (d.after ?? d.before)!.name, null, describeResource(d),
              costTag(d.costBefore, d.costAfter),
            ))}
          </div>
        </section>
      )}

      <section>
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#a1a1aa] mb-2">{t('Changes in items')}</h4>
        {diff.items.length === 0 ? (
          <p className="text-[13px] text-[#a1a1aa]">{t('No differences.')}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {diff.items.map(d => {
              const it = (d.after ?? d.before)!
              return row(d.id, d.kind, it.title, projName(it.projectId), describeItem(d), costTag(d.costBefore, d.costAfter))
            })}
          </div>
        )}
      </section>
    </div>
  )
}
