export interface ActorSync {
  did: string
  commitCid: string
  commitDataCid: string
  rebaseCount: number
  tooBigCount: number
}

export const tableName = 'actor_sync'

export type PartialDB = { [tableName]: ActorSync }
