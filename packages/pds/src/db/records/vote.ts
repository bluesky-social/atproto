import { Kysely } from 'kysely'
import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import * as Vote from '../../lexicon/types/app/bsky/feed/vote'
import { DbRecordPlugin } from '../types'
import * as schemas from '../schemas'
import * as messages from '../message-queue/messages'
import { Message } from '../message-queue/messages'

const type = schemas.ids.AppBskyFeedVote
const tableName = 'vote'

export interface BskyVote {
  uri: string
  cid: string
  creator: string
  direction: 'up' | 'down'
  subject: string
  subjectCid: string
  createdAt: string
  indexedAt: string
}

export type PartialDB = { [tableName]: BskyVote }

const validator = schemas.records.createRecordValidator(type)
const matchesSchema = (obj: unknown): obj is Vote.Record => {
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
        direction: obj.direction,
        creator: uri.host,
        subject: obj.subject.uri,
        subjectCid: obj.subject.cid,
        createdAt: obj.createdAt,
        indexedAt: timestamp || new Date().toISOString(),
      })
      .execute()
    // No events for downvotes
    if (obj.direction === 'down') return []
    const subjectUri = new AtUri(obj.subject.uri)
    return [
      messages.createNotification({
        userDid: subjectUri.host,
        author: uri.host,
        recordUri: uri.toString(),
        recordCid: cid.toString(),
        reason: 'vote',
        reasonSubject: subjectUri.toString(),
      }),
      messages.addUpvote(uri.host, obj.subject.uri),
    ]
  }

const deleteFn =
  (db: Kysely<PartialDB>) =>
  async (uri: AtUri): Promise<Message[]> => {
    const deleted = await db
      .deleteFrom(tableName)
      .where('uri', '=', uri.toString())
      .returningAll()
      .executeTakeFirst()

    const events: Message[] = [messages.deleteNotifications(uri.toString())]
    if (deleted?.direction === 'up') {
      events.push(messages.removeUpvote(deleted.creator, deleted.subject))
    }
    return events
  }

export type PluginType = DbRecordPlugin<Vote.Record>

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
