import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import { DynamicReferenceBuilder } from 'kysely/dist/cjs/dynamic/dynamic-reference-builder'
import { MessageOfType, Listenable } from '../stream/types'
import { Message } from '../stream/messages'
import Database from '.'

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

export interface MessageQueue {
  send(tx: Database, message: MessageOfType | MessageOfType[]): Promise<void>
  listen<T extends string, M extends MessageOfType<T>>(
    topic: T,
    listenable: Listenable<M>,
  ): void
  processNext(): Promise<void>
  processAll(): Promise<void>
  destroy(): void
}
