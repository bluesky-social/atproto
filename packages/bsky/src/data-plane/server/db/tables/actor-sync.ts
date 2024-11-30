export interface ActorSync {
  did: string
  commitCid: string
  repoRev: string | null
}

export const tableName = 'actor_sync'

export type PartialDB = { [tableName]: ActorSync }
