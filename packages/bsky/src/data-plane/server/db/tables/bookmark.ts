export interface Bookmark {
  creator: string
  uri: string
  key: string
  indexedAt: string
}

export const tableName = 'bookmark'

export type PartialDB = { [tableName]: Bookmark }
