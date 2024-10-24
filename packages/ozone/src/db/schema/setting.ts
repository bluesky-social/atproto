import { Generated } from 'kysely'
import { Member } from './member'

export const settingTableName = 'setting'

export type SettingScope = 'personal' | 'instance'

export interface Setting {
  id: Generated<number>
  key: string
  value: any
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
