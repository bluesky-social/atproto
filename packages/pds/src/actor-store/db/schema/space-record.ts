export interface SpaceRecord {
  space: string
  collection: string
  rkey: string
  cid: string
  value: Uint8Array
  repoRev: string
  indexedAt: string
}

const tableName = 'space_record'

export type PartialDB = { [tableName]: SpaceRecord }
