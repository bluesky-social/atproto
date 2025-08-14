export interface Bookmark {
  creator: string
  subjectUri: string
  subjectCid: string
  key: string
  indexedAt: string
}

export const tableName = 'bookmark'

export type PartialDB = { [tableName]: Bookmark }
