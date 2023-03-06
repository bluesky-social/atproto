import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/uri'
import * as Repost from '../../../../lexicon/types/app/bsky/feed/repost'
import * as lex from '../../../../lexicon/lexicons'
import * as messages from '../../../../event-stream/messages'
import {
  DatabaseSchema,
  DatabaseSchemaType,
} from '../../../../db/database-schema'
import RecordProcessor from '../processor'

const lexId = lex.ids.AppBskyFeedRepost
type IndexedRepost = DatabaseSchemaType['repost']

const insertFn = async (
  db: DatabaseSchema,
  uri: AtUri,
  cid: CID,
  obj: Repost.Record,
  timestamp: string,
): Promise<IndexedRepost | null> => {
  const inserted = await db
    .insertInto('repost')
    .values({
      uri: uri.toString(),
      cid: cid.toString(),
      creator: uri.host,
      subject: obj.subject.uri,
      subjectCid: obj.subject.cid,
      createdAt: obj.createdAt,
      indexedAt: timestamp,
    })
    .onConflict((oc) => oc.doNothing())
    .returningAll()
    .executeTakeFirst()
  return inserted || null
}

const findDuplicate = async (
  db: DatabaseSchema,
  uri: AtUri,
  obj: Repost.Record,
): Promise<AtUri | null> => {
  const found = await db
    .selectFrom('repost')
    .where('creator', '=', uri.host)
    .where('subject', '=', obj.subject.uri)
    .selectAll()
    .executeTakeFirst()
  return found ? new AtUri(found.uri) : null
}

const eventsForInsert = (obj: IndexedRepost) => {
  const subjectUri = new AtUri(obj.subject)
  const notif = messages.createNotification({
    userDid: subjectUri.host,
    author: obj.creator,
    recordUri: obj.uri,
    recordCid: obj.cid,
    reason: 'repost',
    reasonSubject: subjectUri.toString(),
  })
  return [notif]
}

const deleteFn = async (
  db: DatabaseSchema,
  uri: AtUri,
): Promise<IndexedRepost | null> => {
  const deleted = await db
    .deleteFrom('repost')
    .where('uri', '=', uri.toString())
    .returningAll()
    .executeTakeFirst()
  return deleted || null
}

const eventsForDelete = (
  deleted: IndexedRepost,
  replacedBy: IndexedRepost | null,
) => {
  if (replacedBy) return []
  return [messages.deleteNotifications(deleted.uri)]
}

export type PluginType = RecordProcessor<Repost.Record, IndexedRepost>

export const makePlugin = (db: DatabaseSchema): PluginType => {
  return new RecordProcessor(db, {
    lexId,
    insertFn,
    findDuplicate,
    deleteFn,
    eventsForInsert,
    eventsForDelete,
  })
}

export default makePlugin
