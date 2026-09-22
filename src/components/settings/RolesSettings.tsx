'use client'

import { useState } from 'react'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import { ROLE_ICONS, DEFAULT_ROLE_ICON, roleIconDef, iconForRoleName } from '@/data/roleIcons'
import type { Role } from '@/types'
import { useTranslation } from '@/lib/i18n/useTranslation'

const labelCls = 'text-[11px] font-semibold text-[#71717a] mb-1.5'
const inputCls = 'w-full text-[13px] text-[#27272a] bg-white border border-[#ececec] rounded-lg px-2.5 py-2 font-inherit'

// A 20x20 chip showing one role's icon at 10x10 — click opens the picker.
function IconButton({ icon, size, title, onClick }: { icon: string; size: number; title: string; onClick: () => void }) {
  const { Icon } = roleIconDef(icon)
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{ width: size, height: size }}
      className="rounded-lg bg-[#f4f4f5] flex items-center justify-center flex-none cursor-pointer border-none p-0"
    >
      <Icon size={10} className="text-[#52525b]" />
    </button>
  )
}

// Small popover grid of the curated icon catalog, each rendered at 10x10.
// The fixed overlay behind it just catches the outside click that closes it.
function IconPicker({ value, onPick, onClose }: { value: string; onPick: (icon: string) => void; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-[1]" onClick={onClose} />
      <div className="absolute top-full left-0 mt-1.5 z-10 bg-white border border-[#ececec] rounded-lg shadow-lg p-1.5 grid grid-cols-6 gap-1 w-[196px]">
        {ROLE_ICONS.map(({ key, Icon, label }) => (
          <button
            key={key}
            type="button"
            title={label}
            onClick={() => onPick(key)}
            className="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer border-none p-0"
            style={{ background: key === value ? '#e7ecfb' : 'transparent' }}
          >
            <Icon size={10} className="text-[#52525b]" />
          </button>
        ))}
      </div>
    </>
  )
}

function RoleRow({ role }: { role: Role }) {
  const { resources, items, renameRole, removeRole, setRoleIcon } = useRoadmapStore()
  const { t } = useTranslation()
  const [name, setName] = useState(role.name)
  const [pickerOpen, setPickerOpen] = useState(false)

  // Keep the local buffer in sync when the role changes from elsewhere (undo/redo,
  // another tab's edit landing via a refresh) — adjusted during render rather than
  // in an effect, so it can't cause an extra render pass.
  const [syncedName, setSyncedName] = useState(role.name)
  if (role.name !== syncedName) {
    setSyncedName(role.name)
    setName(role.name)
  }

  const inUse = resources.some(r => r.role === role.name) || items.some(i => i.requiredRoles?.includes(role.name))

  const commit = () => {
    const trimmed = name.trim()
    if (!trimmed || trimmed === role.name) { setName(role.name); return }
    renameRole(role.name, trimmed)
  }

  return (
    <div className="flex items-center gap-2 px-[9px] py-1.5 border border-[#f1f1f1] rounded-lg relative">
      <IconButton icon={role.icon} size={26} title={t('Change icon')} onClick={() => setPickerOpen(v => !v)} />
      {pickerOpen && (
        <IconPicker value={role.icon} onPick={icon => { setRoleIcon(role.name, icon); setPickerOpen(false) }} onClose={() => setPickerOpen(false)} />
      )}
      <input
        className="flex-1 min-w-0 text-[13px] text-[#27272a] bg-transparent border-none outline-none font-inherit"
        value={name}
        onChange={e => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur() }}
      />
      <button
        onClick={() => removeRole(role.name)}
        disabled={inUse}
        title={inUse ? t('Remove it from people and tasks before deleting') : t('Remove')}
        className="text-[#a1a1aa] text-sm cursor-pointer border-none bg-transparent p-0 flex-none disabled:opacity-30 disabled:cursor-not-allowed"
      >
        ×
      </button>
    </div>
  )
}

function AddRoleRow() {
  const { roles, addRole } = useRoadmapStore()
  const { t } = useTranslation()
  const [name, setName] = useState('')
  // null = follow the name's auto-suggested icon; set once the user picks one by hand.
  const [manualIcon, setManualIcon] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const icon = manualIcon ?? (name.trim() ? iconForRoleName(name) : DEFAULT_ROLE_ICON)
  const exists = roles.some(r => r.name.toLowerCase() === name.trim().toLowerCase())
  const canAdd = name.trim().length > 0 && !exists

  const submit = () => {
    if (!canAdd) return
    addRole(name.trim(), icon)
    setName('')
    setManualIcon(null)
  }

  return (
    <div className="flex items-center gap-2 relative">
      <IconButton icon={icon} size={34} title={t('Change icon')} onClick={() => setPickerOpen(v => !v)} />
      {pickerOpen && (
        <IconPicker value={icon} onPick={i => { setManualIcon(i); setPickerOpen(false) }} onClose={() => setPickerOpen(false)} />
      )}
      <input
        className={`${inputCls} flex-1 min-w-0`}
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder={t('New role name')}
        onKeyDown={e => { if (e.key === 'Enter') submit() }}
      />
      <button
        onClick={submit}
        disabled={!canAdd}
        className="flex-none border border-[#ececec] text-[#52525b] bg-white rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer font-inherit disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {t('Add')}
      </button>
    </div>
  )
}

export default function RolesSettings() {
  const roles = useRoadmapStore(s => s.roles)
  const { t } = useTranslation()

  return (
    <div>
      <div className={labelCls}>{t('Roles')}</div>
      <div className="flex flex-col gap-1.5 mb-2">
        {roles.map(role => <RoleRow key={role.name} role={role} />)}
      </div>
      <AddRoleRow />
    </div>
  )
}
