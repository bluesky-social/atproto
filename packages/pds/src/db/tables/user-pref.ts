import { GeneratedAlways } from 'kysely'

export interface UserPref {
  id: GeneratedAlways<number>
  did: string
  name: string
  valueJson: string // json
}

export const tableName = 'user_pref'

export type PartialDB = { [tableName]: UserPref }
