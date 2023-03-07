export interface DuplicateRecord {
  uri: string
  cid: string
  duplicateOf: string
  indexedAt: string
}

export const tableName = 'duplicate_record'

export type PartialDB = {
  [tableName]: DuplicateRecord
}
