import { Selectable, sql } from 'kysely'
import { CID } from 'multiformats/cid'
import { v3 as murmurV3 } from 'murmurhash'
import { AtUri, normalizeDatetimeAlways } from '@atproto/syntax'
import * as lex from '../../../../lexicon/lexicons'
import * as Follow from '../../../../lexicon/types/app/bsky/graph/follow'
import { BackgroundQueue } from '../../background'
import { Database } from '../../db'
import { DatabaseSchema, DatabaseSchemaType } from '../../db/database-schema'
import { countAll, excluded } from '../../db/util'
import { RecordProcessor } from '../processor'

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
  await db
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
    .execute()
  // explicit locking avoids thrash on single did during backfills
  const didLock = getLockParam(follow.creator)
  const updatePostsCount = (txn: DatabaseSchema) =>
    txn
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
      .execute()
  await db.transaction().execute(async (txn) => {
    const runlocked = await tryAdvisoryLock(txn, LOCK_FOLLOWCOUNT_RUN, didLock)
    if (runlocked) {
      await updatePostsCount(txn)
      return
    }
    const waitlock = await tryAdvisoryLock(txn, LOCK_FOLLOWCOUNT_WAIT, didLock)
    if (waitlock) {
      await acquireAdvisoryLock(txn, LOCK_FOLLOWCOUNT_RUN, didLock)
      await updatePostsCount(txn)
    }
  })
}

export type PluginType = RecordProcessor<Follow.Record, IndexedFollow>

export const makePlugin = (
  db: Database,
  background: BackgroundQueue,
): PluginType => {
  return new RecordProcessor(db, background, {
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

const LOCK_FOLLOWCOUNT_RUN = 1020
const LOCK_FOLLOWCOUNT_WAIT = 1021
function getLockParam(key: string) {
  return murmurV3(key)
}

/**
 * Try to acquire a transaction-level advisory lock (non-blocking)
 */
async function tryAdvisoryLock(
  txn: DatabaseSchema,
  lockId: number,
  lockParam: number,
): Promise<boolean> {
  const result = await sql<{ locked: boolean }>`
    SELECT pg_try_advisory_xact_lock(${lockId}, ${lockParam}) as locked
  `.execute(txn)
  return result.rows[0].locked
}

/**
 * Acquire a transaction-level advisory lock (blocking)
 */
async function acquireAdvisoryLock(
  txn: DatabaseSchema,
  lockId: number,
  lockParam: number,
): Promise<void> {
  await sql`SELECT pg_advisory_xact_lock(${lockId}, ${lockParam})`.execute(txn)
}
