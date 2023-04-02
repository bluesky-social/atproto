import { Generated } from 'kysely'

export interface Actor {
  did: string
  handle: string
  indexedAt: string
  followersCount: Generated<number>
  followsCount: Generated<number>
  postsCount: Generated<number>
  takedownId: number | null // @TODO(bsky)
}

export const tableName = 'actor'

export type PartialDB = { [tableName]: Actor }
