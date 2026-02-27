import { Selectable } from 'kysely'
import { Cid } from '@atproto/lex-data'
import { AtUri, normalizeDatetimeAlways } from '@atproto/syntax'
import { app } from '../../../../lexicons'
import { BackgroundQueue } from '../../background'
import { Database } from '../../db'
import { DatabaseSchema, DatabaseSchemaType } from '../../db/database-schema'
import { countAll, excluded } from '../../db/util'
import { RecordProcessor } from '../processor'

type IndexedFollow = Selectable<DatabaseSchemaType['follow']>

const insertFn = async (
  db: DatabaseSchema,
  uri: AtUri,
  cid: Cid,
  obj: app.bsky.graph.follow.Main,
  timestamp: string,
): Promise<IndexedFollow | null> => {
  const inserted = await db
    .insertInto('follow')
    .values({
      uri: uri.toString(),
      cid: cid.toString(),
      creator: uri.host,
      subjectDid: obj.subject,
      createdAt: normalizeDatetimeAlways(obj.createdAt),
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
  obj: app.bsky.graph.follow.Main,
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

export type PluginType = ReturnType<typeof makePlugin>
export const makePlugin = (db: Database, background: BackgroundQueue) => {
  return new RecordProcessor(db, background, {
    schema: app.bsky.graph.follow.main,
    insertFn,
    findDuplicate,
    deleteFn,
    notifsForInsert,
    notifsForDelete,
    updateAggregates,
  })
}

export default makePlugin
