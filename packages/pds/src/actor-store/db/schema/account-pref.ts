import { GeneratedAlways } from 'kysely'

export interface AccountPref {
  id: GeneratedAlways<number>
  name: string
  valueJson: string // json
}

export const tableName = 'account_pref'

export type PartialDB = { [tableName]: AccountPref }
