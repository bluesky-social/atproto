export interface PrivateRecord {
  uri: string
  actorDid: string
  collection: string
  rkey: string
  // JSON-encoded record
  payload: string
  indexedAt: string
}

export const tableName = 'private_record'

export type PartialDB = { [tableName]: PrivateRecord }
