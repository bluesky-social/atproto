export interface SavedFeed {
  userDid: string
  feedUri: string
  createdAt: string
}

export const tableName = 'saved_feed'

export type PartialDB = { [tableName]: SavedFeed }
