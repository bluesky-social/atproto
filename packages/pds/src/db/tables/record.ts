export interface Record {
  uri: string
  cid: string
  did: string
  collection: string
  rkey: string
  raw: string // @TODO remove me
  receivedAt: string
  indexedAt: string
}

export const tableName = 'record'

export type PartialDB = { [tableName]: Record }
