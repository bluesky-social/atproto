import { Selectable } from 'kysely'
import { AtUri } from '@atproto/syntax'
import { toSimplifiedISOSafe } from '@atproto/common'
import { CID } from 'multiformats/cid'
import * as Follow from '../../../lexicon/types/app/bsky/graph/follow'
import * as lex from '../../../lexicon/lexicons'
import { DatabaseSchema, DatabaseSchemaType } from '../../../db/database-schema'
import RecordProcessor from '../processor'
import { PrimaryDatabase } from '../../../db'
import { countAll, excluded } from '../../../db/util'
import { BackgroundQueue } from '../../../background'
import { NotificationServer } from '../../../notifications'

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
      sortAt: obj.sortAt,
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

const updateAggregates = async (db: DatabaseSchema, follow: IndexedFollow) => {
  const followersCountQb = db
    .insertInto('profile_agg')
    .values({
      did: follow.subjectDid,
      followersCount: db
        .selectFrom('follow')
        .where('follow.subjectDid', '=', follow.subjectDid)
        .select(countAll.as('count')),
    })
    .onConflict((oc) =>
      oc.column('did').doUpdateSet({
        followersCount: excluded(db, 'followersCount'),
      }),
    )
  const followsCountQb = db
    .insertInto('profile_agg')
    .values({
      did: follow.creator,
      followsCount: db
        .selectFrom('follow')
        .where('follow.creator', '=', follow.creator)
        .select(countAll.as('count')),
    })
    .onConflict((oc) =>
      oc.column('did').doUpdateSet({
        followsCount: excluded(db, 'followsCount'),
      }),
    )
  await Promise.all([followersCountQb.execute(), followsCountQb.execute()])
}

export type PluginType = RecordProcessor<Follow.Record, IndexedFollow>

export const makePlugin = (
  db: PrimaryDatabase,
  backgroundQueue: BackgroundQueue,
  notifServer?: NotificationServer,
): PluginType => {
  return new RecordProcessor(db, backgroundQueue, notifServer, {
    lexId,
    insertFn,
    findDuplicate,
    deleteFn,
    notifsForInsert,
    notifsForDelete,
    updateAggregates,
  })
}

export default makePlugin
