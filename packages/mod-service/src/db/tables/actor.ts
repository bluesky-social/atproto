export interface Actor {
  did: string
  handle: string | null
  indexedAt: string
  takedownId: number | null // @TODO(bsky)
}

export const tableName = 'actor'

export type PartialDB = { [tableName]: Actor }
