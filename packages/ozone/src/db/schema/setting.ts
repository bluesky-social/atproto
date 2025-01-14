import { Generated, GeneratedAlways } from 'kysely'
import { Member } from './member'

export const settingTableName = 'setting'

export type SettingScope = 'personal' | 'instance'

export interface Setting {
  id: GeneratedAlways<number>
  key: string
  value: Record<string, unknown>
  managerRole: Member['role'] | null
  description: string | null
  did: string
  scope: SettingScope
  lastUpdatedBy: string
  createdBy: string
  createdAt: Generated<Date>
  updatedAt: Generated<Date>
}

export type PartialDB = {
  [settingTableName]: Setting
}
