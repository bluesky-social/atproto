import { DidDocument } from '@atproto/did-resolver'

export interface DidCache {
  did: string
  doc: DidDocument
  updatedAt: number
}

export const tableName = 'did_cache'

export type PartialDB = {
  [tableName]: DidCache
}
