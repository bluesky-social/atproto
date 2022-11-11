import { Kysely } from 'kysely'
import { AtUri } from '@atproto/uri'
import * as Repost from '../../lexicon/types/app/bsky/feed/repost'
import { DbRecordPlugin } from '../types'
import * as schemas from '../schemas'
import { CID } from 'multiformats/cid'
import * as messages from '../message-queue/messages'
import { Message } from '../message-queue/messages'

const type = schemas.ids.AppBskyFeedRepost
const tableName = 'repost'

export interface BskyRepost {
  uri: string
  cid: string
  creator: string
  subject: string
  subjectCid: string
  createdAt: string
  indexedAt: string
}

export type PartialDB = { [tableName]: BskyRepost }

const validator = schemas.records.createRecordValidator(type)
const matchesSchema = (obj: unknown): obj is Repost.Record => {
  return validator.isValid(obj)
}
const validateSchema = (obj: unknown) => validator.validate(obj)

const insertFn =
  (db: Kysely<PartialDB>) =>
  async (
    uri: AtUri,
    cid: CID,
    obj: unknown,
    timestamp?: string,
  ): Promise<Message[]> => {
    if (!matchesSchema(obj)) {
      throw new Error(`Record does not match schema: ${type}`)
    }
    await db
      .insertInto(tableName)
      .values({
        uri: uri.toString(),
        cid: cid.toString(),
        creator: uri.host,
        subject: obj.subject.uri,
        subjectCid: obj.subject.cid,
        createdAt: obj.createdAt,
        indexedAt: timestamp || new Date().toISOString(),
      })
      .execute()
    const subjectUri = new AtUri(obj.subject.uri)
    const notif = messages.createNotification({
      userDid: subjectUri.host,
      author: uri.host,
      recordUri: uri.toString(),
      recordCid: cid.toString(),
      reason: 'repost',
      reasonSubject: subjectUri.toString(),
    })
    return [notif]
  }

const deleteFn =
  (db: Kysely<PartialDB>) =>
  async (uri: AtUri): Promise<Message[]> => {
    await db.deleteFrom(tableName).where('uri', '=', uri.toString()).execute()
    return [messages.deleteNotifications(uri.toString())]
  }

export type PluginType = DbRecordPlugin<Repost.Record>

export const makePlugin = (db: Kysely<PartialDB>): PluginType => {
  return {
    collection: type,
    validateSchema,
    matchesSchema,
    insert: insertFn(db),
    delete: deleteFn(db),
  }
}

export default makePlugin
