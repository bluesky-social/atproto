import { Kysely } from 'kysely'
import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/uri'
import * as Trend from '../../../lexicon/types/app/bsky/feed/trend'
import * as lex from '../../../lexicon/lexicons'
import * as messages from '../../../event-stream/messages'
import { Message } from '../../../event-stream/messages'
import DatabaseSchema from '../../../db/database-schema'
import RecordProcessor from '../processor'

const lexId = lex.ids.AppBskyFeedTrend
type IndexedTrend = DatabaseSchema['trend']

const insertFn = async (
  db: Kysely<DatabaseSchema>,
  uri: AtUri,
  cid: CID,
  obj: Trend.Record,
  timestamp?: string,
): Promise<IndexedTrend | null> => {
  const inserted = await db
    .insertInto('trend')
    .values({
      uri: uri.toString(),
      cid: cid.toString(),
      creator: uri.host,
      subject: obj.subject.uri,
      subjectCid: obj.subject.cid,
      createdAt: obj.createdAt,
      indexedAt: timestamp || new Date().toISOString(),
    })
    .onConflict((oc) => oc.doNothing())
    .returningAll()
    .executeTakeFirst()
  return inserted || null
}

const findDuplicate = async (
  db: Kysely<DatabaseSchema>,
  uri: AtUri,
  obj: Trend.Record,
): Promise<AtUri | null> => {
  const found = await db
    .selectFrom('trend')
    .where('creator', '=', uri.host)
    .where('subject', '=', obj.subject.uri)
    .selectAll()
    .executeTakeFirst()
  return found ? new AtUri(found.uri) : null
}

const eventsForInsert = (obj: IndexedTrend): Message[] => {
  const subjectUri = new AtUri(obj.subject)
  const notif = messages.createNotification({
    userDid: subjectUri.host,
    author: obj.creator,
    recordUri: obj.uri,
    recordCid: obj.cid,
    reason: 'trend',
    reasonSubject: subjectUri.toString(),
  })
  return [notif]
}

const deleteFn = async (
  db: Kysely<DatabaseSchema>,
  uri: AtUri,
): Promise<IndexedTrend | null> => {
  const deleted = await db
    .deleteFrom('trend')
    .where('uri', '=', uri.toString())
    .returningAll()
    .executeTakeFirst()
  return deleted || null
}

const eventsForDelete = (
  deleted: IndexedTrend,
  replacedBy: IndexedTrend | null,
): Message[] => {
  if (replacedBy) return []
  return [messages.deleteNotifications(deleted.uri)]
}

export type PluginType = RecordProcessor<Trend.Record, IndexedTrend>

export const makePlugin = (db: Kysely<DatabaseSchema>): PluginType => {
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
