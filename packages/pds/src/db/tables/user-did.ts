export interface UserDid {
  did: string
  handle: string
}

export const tableName = 'user_did'

export type PartialDB = { [tableName]: UserDid }
