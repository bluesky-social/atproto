import { Kysely } from 'kysely'
import { AtUri } from '@atproto/uri'
import * as Repost from '../../lexicon/types/app/bsky/feed/repost'
import { Repost as IndexedRepost } from '../tables/repost'
import * as lex from '../../lexicon/lexicons'
import { CID } from 'multiformats/cid'
import * as messages from '../../stream/messages'
import { Message } from '../../stream/messages'
import { DatabaseSchema } from '../database-schema'
import RecordProcessor from '../record-processor'

const lexId = lex.ids.AppBskyFeedRepost

const insertFn = async (
  db: Kysely<DatabaseSchema>,
  uri: AtUri,
  cid: CID,
  obj: Repost.Record,
  timestamp?: string,
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

const eventsForInsert = (obj: IndexedRepost): Message[] => {
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
  db: Kysely<DatabaseSchema>,
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
): Message[] => {
  if (replacedBy) return []
  return [messages.deleteNotifications(deleted.uri)]
}

export type PluginType = RecordProcessor<Repost.Record, IndexedRepost>

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
