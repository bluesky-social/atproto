import { Selectable, sql } from 'kysely'
import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import * as Follow from '../../../lexicon/types/app/bsky/graph/follow'
import * as lex from '../../../lexicon/lexicons'
import { DatabaseSchema, DatabaseSchemaType } from '../../../db/database-schema'
import RecordProcessor from '../processor'
import { toSimplifiedISOSafe } from '../util'
import Database from '../../../db'
import { BackgroundQueue } from '../../../background'

const lexId = lex.ids.AppBskyGraphFollow
type IndexedFollow = Selectable<DatabaseSchemaType['follow']>

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
      createdAt: toSimplifiedISOSafe(obj.createdAt),
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

const notifsForInsert = (obj: IndexedFollow) => {
  return [
    {
      did: obj.subjectDid,
      author: obj.creator,
      recordUri: obj.uri,
      recordCid: obj.cid,
      reason: 'follow' as const,
      reasonSubject: null,
      sortAt: obj.indexedAt,
    },
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
  return deleted || null
}

const notifsForDelete = (
  deleted: IndexedFollow,
  replacedBy: IndexedFollow | null,
) => {
  const toDelete = replacedBy ? [] : [deleted.uri]
  return { notifs: [], toDelete }
}

const afterInsert = async (db: DatabaseSchema, inserted: IndexedFollow) => {
  const { ref } = db.dynamic
  const followersCountQb = db
    .insertInto('profile_agg')
    .values({
      did: inserted.subjectDid,
      followersCount: 1,
    })
    .onConflict((oc) =>
      oc.column('did').doUpdateSet({
        followersCount: sql`${ref('profile_agg.followersCount')} + 1`,
      }),
    )
  const followsCountQb = db
    .insertInto('profile_agg')
    .values({
      did: inserted.creator,
      followsCount: 1,
    })
    .onConflict((oc) =>
      oc.column('did').doUpdateSet({
        followsCount: sql`${ref('profile_agg.followsCount')} + 1`,
      }),
    )
  await Promise.all([followersCountQb.execute(), followsCountQb.execute()])
}

// posts are never replaced by another post
const afterDelete = async (
  db: DatabaseSchema,
  deleted: IndexedFollow,
  replacedBy: IndexedFollow | null,
) => {
  const { ref } = db.dynamic
  if (replacedBy) {
    return
  }
  const followersCountQb = db
    .updateTable('profile_agg')
    .set({
      followersCount: sql`${ref('profile_agg.followersCount')} - 1`,
    })
    .where('did', '=', deleted.subjectDid)
  const followsCountQb = db
    .updateTable('profile_agg')
    .set({
      followsCount: sql`${ref('profile_agg.followsCount')} - 1`,
    })
    .where('did', '=', deleted.creator)
  await Promise.all([followersCountQb.execute(), followsCountQb.execute()])
}

export type PluginType = RecordProcessor<Follow.Record, IndexedFollow>

export const makePlugin = (
  db: Database,
  backgroundQueue: BackgroundQueue,
): PluginType => {
  return new RecordProcessor(db, backgroundQueue, {
    lexId,
    insertFn,
    findDuplicate,
    deleteFn,
    notifsForInsert,
    notifsForDelete,
    afterInsert,
    afterDelete,
  })
}

export default makePlugin
