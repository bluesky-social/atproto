import { GeneratedAlways } from 'kysely'

export const tableName = 'labeler'

export interface FeedGenerator {
  uri: string
  cid: string
  creator: string
  labelerDid: string
  createdAt: string
  indexedAt: string
  sortAt: GeneratedAlways<string>
}

export type PartialDB = {
  [tableName]: FeedGenerator
}
