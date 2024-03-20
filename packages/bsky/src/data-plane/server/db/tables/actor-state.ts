export interface ActorState {
  did: string
  lastSeenNotifs: string
}

export const tableName = 'actor_state'

export type PartialDB = { [tableName]: ActorState }
