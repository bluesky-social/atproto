import { DidDocument } from '@atproto/did-resolver'
import { GeneratedAlways } from 'kysely'

export interface DidCache {
  did: string
  doc: DidDocument
  updatedAt: GeneratedAlways<Date>
}

export const tableName = 'did_cache'

export type PartialDB = {
  [tableName]: DidCache
}
