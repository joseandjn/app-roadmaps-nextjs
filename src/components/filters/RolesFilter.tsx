'use client'

import { useRoadmapStore } from '@/store/useRoadmapStore'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { roleIconDef } from '@/data/roleIcons'
import FilterChip from './FilterChip'

// Roles chip. An item matches a role if it requires it or someone with that
// role is assigned (see itemMatch). Resources shows people with the role;
// Costs counts only their assignments.
export default function RolesFilter() {
  const { roles, filters, toggleFilterValue, setFilters } = useRoadmapStore()
  const { t } = useTranslation()

  return (
    <FilterChip
      label={t('Roles')}
      options={roles.map(role => {
        const { Icon } = roleIconDef(role.icon)
        return { value: role.name, label: t(role.name), icon: <Icon size={13} className="flex-none text-[#71717a]" /> }
      })}
      selected={filters.roles}
      onToggle={v => toggleFilterValue('roles', v)}
      onSetAll={v => setFilters({ roles: v })}
      header={
        <div className="px-1.5 py-1 text-[11px] text-[#71717a] leading-snug">
          {t('Matches tasks that require the role or have someone with it assigned.')}
        </div>
      }
    />
  )
}
