import type { ComponentType } from 'react'
import GeneralSettings from './GeneralSettings'
import HolidaysSettings from './HolidaysSettings'
import RolesSettings from './RolesSettings'

export interface SettingsSectionDef {
  id: string
  Component: ComponentType
}

// The Settings tab (SettingsView) is agnostic to what sections exist — it just
// lays out this list in order, one card per entry. Each section is fully
// self-contained (own heading, own store reads/writes), so adding a new
// settings area is just writing that component and listing it here; the
// container never needs to change.
export const SETTINGS_SECTIONS: SettingsSectionDef[] = [
  { id: 'general', Component: GeneralSettings },
  { id: 'holidays', Component: HolidaysSettings },
  { id: 'roles', Component: RolesSettings },
]
