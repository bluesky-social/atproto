import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import { DynamicReferenceBuilder } from 'kysely/dist/cjs/dynamic/dynamic-reference-builder'
import { Message } from '../stream/messages'

export type DbRecordPlugin<T> = {
  collection: string
  assertValidRecord: (obj: unknown) => void
  matchesSchema: (obj: unknown) => obj is T
  insert: (
    uri: AtUri,
    cid: CID,
    obj: unknown,
    timestamp?: string,
  ) => Promise<Message[]>
  delete: (uri: AtUri) => Promise<Message[]>
}

export type Ref = DynamicReferenceBuilder<any>
