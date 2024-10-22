import { Generated } from 'kysely'

export const settingTableName = 'setting'

export type SettingManagerRole = 'admin' | 'moderator' | 'triage' | 'owner'
export type SettingScope = 'personal' | 'instance'

export interface Setting {
  id: Generated<number>
  key: string
  value: any
  managerRole: SettingManagerRole
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
