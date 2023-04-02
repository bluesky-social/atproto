import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import * as Like from '../../../lexicon/types/app/bsky/feed/like'
import * as lex from '../../../lexicon/lexicons'
import { DatabaseSchema, DatabaseSchemaType } from '../../../db/database-schema'
import * as messages from '../messages'
import { Message } from '../messages'
import RecordProcessor from '../processor'
import { countAll } from '../../../db/util'

const lexId = lex.ids.AppBskyFeedLike
type IndexedLike = DatabaseSchemaType['like']

const insertFn = async (
  db: DatabaseSchema,
  uri: AtUri,
  cid: CID,
  obj: Like.Record,
  timestamp: string,
): Promise<IndexedLike | null> => {
  const inserted = await db
    .insertInto('like')
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
  if (inserted) {
    await updateAggregates(db, inserted)
  }
  return inserted || null
}

const findDuplicate = async (
  db: DatabaseSchema,
  uri: AtUri,
  obj: Like.Record,
): Promise<AtUri | null> => {
  const found = await db
    .selectFrom('like')
    .where('creator', '=', uri.host)
    .where('subject', '=', obj.subject.uri)
    .selectAll()
    .executeTakeFirst()
  return found ? new AtUri(found.uri) : null
}

const createNotif = (obj: IndexedLike) => {
  const subjectUri = new AtUri(obj.subject)
  return messages.createNotification({
    userDid: subjectUri.host,
    author: obj.creator,
    recordUri: obj.uri,
    recordCid: obj.cid,
    reason: 'like',
    reasonSubject: subjectUri.toString(),
  })
}

const eventsForInsert = (obj: IndexedLike) => {
  return [createNotif(obj)]
}

const deleteFn = async (
  db: DatabaseSchema,
  uri: AtUri,
): Promise<IndexedLike | null> => {
  const deleted = await db
    .deleteFrom('like')
    .where('uri', '=', uri.toString())
    .returningAll()
    .executeTakeFirst()
  if (deleted) {
    await updateAggregates(db, deleted)
  }
  return deleted || null
}

const eventsForDelete = (
  deleted: IndexedLike,
  replacedBy: IndexedLike | null,
): Message[] => {
  if (!replacedBy) {
    return [messages.deleteNotifications(deleted.uri)]
  }
  return []
}

export type PluginType = RecordProcessor<Like.Record, IndexedLike>

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

async function updateAggregates(db: DatabaseSchema, like: IndexedLike) {
  await db
    .updateTable('post')
    .where('uri', '=', like.subject)
    .set({
      likeCount: db
        .selectFrom('like')
        .where('subject', '=', like.subject)
        .select(countAll.as('count')),
    })
    .execute()
}
