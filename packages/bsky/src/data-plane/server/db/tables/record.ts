export interface Record {
  uri: string
  cid: string
  did: string
  rev: string
  json: string
  indexedAt: string
  takedownRef: string | null
}

export const tableName = 'record'

export type PartialDB = { [tableName]: Record }
