export interface Bookmark {
  creator: string
  key: string
  subjectUri: string
  subjectCid: string
  indexedAt: string
}

export const tableName = 'bookmark'

export type PartialDB = { [tableName]: Bookmark }
