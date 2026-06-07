export const tableName = 'actor'

export interface Actor {
  did: string
  handle: string | null
  pdsEndpoint: string | null
  displayName: string | null
  description: string | null
  avatarCid: string | null
  bannerCid: string | null
  followersCount: number
  postsCount: number
  upstreamStatus: string
  indexedAt: string
}

export type PartialDB = { [tableName]: Actor }
