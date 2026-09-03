import type { Generated, GeneratedAlways } from 'kysely'
import type { DidString } from '@atproto/lex'
import type { Member } from './member.js'

export const settingTableName = 'setting'

export type SettingScope = 'personal' | 'instance'

export interface Setting {
  id: GeneratedAlways<number>
  key: string
  value: Record<string, unknown>
  managerRole: Member['role'] | null
  description: string | null
  did: DidString
  scope: SettingScope
  lastUpdatedBy: DidString
  createdBy: DidString
  createdAt: Generated<Date>
  updatedAt: Generated<Date>
}

export type PartialDB = {
  [settingTableName]: Setting
}
