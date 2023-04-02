import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import * as Follow from '../../../lexicon/types/app/bsky/graph/follow'
import * as lex from '../../../lexicon/lexicons'
import { DatabaseSchema, DatabaseSchemaType } from '../../../db/database-schema'
import * as messages from '../messages'
import RecordProcessor from '../processor'
import { countAll } from '../../../db/util'

const lexId = lex.ids.AppBskyGraphFollow
type IndexedFollow = DatabaseSchemaType['follow']

const insertFn = async (
  db: DatabaseSchema,
  uri: AtUri,
  cid: CID,
  obj: Follow.Record,
  timestamp: string,
): Promise<IndexedFollow | null> => {
  const inserted = await db
    .insertInto('follow')
    .values({
      uri: uri.toString(),
      cid: cid.toString(),
      creator: uri.host,
      subjectDid: obj.subject,
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
  obj: Follow.Record,
): Promise<AtUri | null> => {
  const found = await db
    .selectFrom('follow')
    .where('creator', '=', uri.host)
    .where('subjectDid', '=', obj.subject)
    .selectAll()
    .executeTakeFirst()
  return found ? new AtUri(found.uri) : null
}

const eventsForInsert = (obj: IndexedFollow) => {
  return [
    messages.createNotification({
      userDid: obj.subjectDid,
      author: obj.creator,
      recordUri: obj.uri,
      recordCid: obj.cid,
      reason: 'follow',
    }),
  ]
}

const deleteFn = async (
  db: DatabaseSchema,
  uri: AtUri,
): Promise<IndexedFollow | null> => {
  const deleted = await db
    .deleteFrom('follow')
    .where('uri', '=', uri.toString())
    .returningAll()
    .executeTakeFirst()
  if (deleted) {
    await updateAggregates(db, deleted)
  }
  return deleted || null
}

const eventsForDelete = (
  deleted: IndexedFollow,
  replacedBy: IndexedFollow | null,
) => {
  if (replacedBy) return []
  return [messages.deleteNotifications(deleted.uri)]
}

export type PluginType = RecordProcessor<Follow.Record, IndexedFollow>

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

async function updateAggregates(db: DatabaseSchema, follow: IndexedFollow) {
  // await Promise.all([
  await db
    .updateTable('actor')
    .where('did', '=', follow.creator)
    .set({
      followsCount: db
        .selectFrom('follow')
        .where('creator', '=', follow.creator)
        .select(countAll.as('count')),
    })
    .execute()
  await db
    .updateTable('actor')
    .where('did', '=', follow.subjectDid)
    .set({
      followersCount: db
        .selectFrom('follow')
        .where('subjectDid', '=', follow.subjectDid)
        .select(countAll.as('count')),
    })
    .execute()
  // ])
}
