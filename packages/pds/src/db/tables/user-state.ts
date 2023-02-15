export interface UserState {
  did: string
  lastSeenNotifs: string
}

export const tableName = 'user_state'

export type PartialDB = { [tableName]: UserState }
