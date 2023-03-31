export interface Actor {
  did: string
  handle: string
  indexedAt: string
  commitDataCid: string | null
  takedownId: number | null // @TODO(bsky)
}

export const tableName = 'actor'

export type PartialDB = { [tableName]: Actor }
