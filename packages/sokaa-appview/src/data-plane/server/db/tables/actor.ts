import { Generated } from 'kysely'

export const tableName = 'actor'

export interface Actor {
  did: string
  handle: string | null
  pdsEndpoint: string | null
  displayName: string | null
  description: string | null
  avatarCid: string | null
  bannerCid: string | null
  // Generated<> = Postgres DEFAULT on insert; reads still return plain number/string.
  followersCount: Generated<number>
  postsCount: Generated<number>
  upstreamStatus: Generated<string>
  indexedAt: string
}

export type PartialDB = { [tableName]: Actor }
