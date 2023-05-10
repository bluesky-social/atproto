export interface UserPref {
  did: string
  name: string
  valueJson: string // json
}

export const tableName = 'user_pref'

export type PartialDB = { [tableName]: UserPref }
