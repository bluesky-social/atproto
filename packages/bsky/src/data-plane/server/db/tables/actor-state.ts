export interface ActorState {
  did: string
  lastSeenNotifs: string
  priorityNotifs: boolean
}

export const tableName = 'actor_state'

export type PartialDB = { [tableName]: ActorState }
