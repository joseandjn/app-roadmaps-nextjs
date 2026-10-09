import type { ComponentType } from 'react'
import { SlidersHorizontal, CalendarDays, Shapes, Tags, Users, Wallet, Database, Languages, GitBranch, Archive, type LucideIcon } from 'lucide-react'
import GeneralSettings from './GeneralSettings'
import CalendarSettings from './CalendarSettings'
import RolesSettings from './RolesSettings'
import CategoriesSettings from './CategoriesSettings'
import PeopleSettings from './PeopleSettings'
import CostSettings from './CostSettings'
import KnowledgeSettings from './KnowledgeSettings'
import ScenariosSettings from './ScenariosSettings'
import BackupSettings from './BackupSettings'
import FormatSettings from './FormatSettings'

export interface SettingsSectionDef {
  id: string
  group: string // sidebar heading it's listed under (English key, translated)
  label: string
  description: string
  icon: LucideIcon
  Component: ComponentType
}

// The Settings tab (SettingsView) is agnostic to what sections exist — it
// builds its sidebar from this list (grouped by `group`, in order) and shows
// the picked section's component. Each section is fully self-contained (own
// store reads/writes), so adding a settings area is just writing that
// component and listing it here; the container never needs to change.
export const SETTINGS_SECTIONS: SettingsSectionDef[] = [
  { id: 'general', group: 'Plan', label: 'General', icon: SlidersHorizontal, Component: GeneralSettings, description: 'Defaults for new tasks and projects.' },
  { id: 'calendar', group: 'Plan', label: 'Calendar', icon: CalendarDays, Component: CalendarSettings, description: 'Working hours, weekends and holidays: they set durations in working days, capacity and cost.' },
  { id: 'roles', group: 'Plan', label: 'Roles', icon: Shapes, Component: RolesSettings, description: 'Roles people can have and tasks can require.' },
  { id: 'categories', group: 'Plan', label: 'Categories', icon: Tags, Component: CategoriesSettings, description: 'Categories to group projects by. Renaming one updates the projects that use it.' },
  { id: 'people', group: 'Team', label: 'People', icon: Users, Component: PeopleSettings, description: 'Who works on the roadmap, with their role, rate and availability.' },
  { id: 'costs', group: 'Team', label: 'Costs', icon: Wallet, Component: CostSettings, description: 'Currency and how time off counts toward cost.' },
  { id: 'scenarios', group: 'Data', label: 'Scenarios', icon: GitBranch, Component: ScenariosSettings, description: 'Every version of the roadmap: rename, open, make official, duplicate or delete.' },
  { id: 'backup', group: 'Data', label: 'Backup', icon: Archive, Component: BackupSettings, description: 'Download roadmaps as a file, or bring one back. Your data only lives on this machine: keep a copy.' },
  { id: 'knowledge', group: 'Data', label: 'Knowledge base', icon: Database, Component: KnowledgeSettings, description: 'Finished tasks with their estimates and actual duration, to download.' },
  { id: 'format', group: 'Preferences', label: 'Format', icon: Languages, Component: FormatSettings, description: 'Language and how dates are written. Personal: saved in this browser.' },
]
