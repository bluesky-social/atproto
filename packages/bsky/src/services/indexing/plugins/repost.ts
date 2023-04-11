import { Selectable } from 'kysely'
import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/uri'
import * as Repost from '../../../lexicon/types/app/bsky/feed/repost'
import * as lex from '../../../lexicon/lexicons'
import { DatabaseSchema, DatabaseSchemaType } from '../../../db/database-schema'
import * as messages from '../messages'
import RecordProcessor from '../processor'

const lexId = lex.ids.AppBskyFeedRepost
type IndexedRepost = Selectable<DatabaseSchemaType['repost']>

const insertFn = async (
  db: DatabaseSchema,
  uri: AtUri,
  cid: CID,
  obj: Repost.Record,
  timestamp: string,
): Promise<IndexedRepost | null> => {
  const repost = {
    uri: uri.toString(),
    cid: cid.toString(),
    creator: uri.host,
    subject: obj.subject.uri,
    subjectCid: obj.subject.cid,
    createdAt: obj.createdAt,
    indexedAt: timestamp,
  }
  const [inserted] = await Promise.all([
    db
      .insertInto('repost')
      .values(repost)
      .onConflict((oc) => oc.doNothing())
      .returningAll()
      .executeTakeFirst(),
    db
      .insertInto('feed_item')
      .values({
        type: 'repost',
        uri: repost.uri,
        cid: repost.cid,
        postUri: repost.subject,
        originatorDid: repost.creator,
        sortAt:
          repost.indexedAt < repost.createdAt
            ? repost.indexedAt
            : repost.createdAt,
      })
      .onConflict((oc) => oc.doNothing())
      .executeTakeFirst(),
  ])

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
  const uriStr = uri.toString()
  const [deleted] = await Promise.all([
    db
      .deleteFrom('repost')
      .where('uri', '=', uriStr)
      .returningAll()
      .executeTakeFirst(),
    db.deleteFrom('feed_item').where('uri', '=', uriStr).executeTakeFirst(),
  ])
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
