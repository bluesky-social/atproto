export interface UserDid {
  did: string
  username: string
}

export const tableName = 'user_did'

export type PartialDB = { [tableName]: UserDid }
