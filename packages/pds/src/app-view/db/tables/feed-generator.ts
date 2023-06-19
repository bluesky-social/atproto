export const tableName = 'feed_generator'

export interface FeedGenerator {
  uri: string
  cid: string
  creator: string
  feedDid: string
  displayName: string
  description: string | null
  descriptionFacets: string | null
  avatarCid: string | null
  createdAt: string
  indexedAt: string
}

export type PartialDB = {
  [tableName]: FeedGenerator
}
