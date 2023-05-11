export interface FeedBookmark {
  userDid: string
  feedUri: string
  createdAt: string
}

export const tableName = 'feed_bookmark'

export type PartialDB = { [tableName]: FeedBookmark }
