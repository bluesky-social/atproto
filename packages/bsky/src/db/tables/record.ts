export interface Record {
  uri: string
  cid: string
  did: string
  json: string
  indexedAt: string
  takedownId: string | null // @TODO(bsky)
}

export const tableName = 'record'

export type PartialDB = { [tableName]: Record }
