import { AtUri } from '@atproto/uri'
import { ValidationResult } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { DynamicReferenceBuilder } from 'kysely/dist/cjs/dynamic/dynamic-reference-builder'
import { Message } from './message-queue/messages'

export type DbRecordPlugin<T> = {
  collection: string
  validateSchema: (obj: unknown) => ValidationResult
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

export interface MessageQueue {
  send(message: Message): Promise<void>
  catchup(): Promise<void>
}
