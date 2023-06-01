export interface DidCache {
  did: string
  doc: string // json representation of DidDocument
  updatedAt: number
}

export const tableName = 'did_cache'

export type PartialDB = {
  [tableName]: DidCache
}
