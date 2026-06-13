import { Selectable } from 'kysely'
import { CID } from 'multiformats/cid'
import { AppSokaaGraphFollow } from '@atproto/api'
import { AtUri } from '@atproto/syntax'
import { Database } from '../../db'
import { DatabaseSchema, DatabaseSchemaType } from '../../db/database-schema'
import { countAll, excluded } from '../../db/util'
import { ids } from '../collections'
import { RecordProcessor } from '../processor'
import { normalizeCreatedAt } from '../sanitizers'

type IndexedFollow = Selectable<DatabaseSchemaType['follow']>

const insertFn = async (
  db: DatabaseSchema,
  uri: AtUri,
  cid: CID,
  obj: AppSokaaGraphFollow.Record,
  timestamp: string,
): Promise<IndexedFollow | null> => {
  const inserted = await db
    .insertInto('follow')
    .values({
      uri: uri.toString(),
      creator: uri.host,
      subjectDid: obj.subject,
      createdAt: normalizeCreatedAt(obj.createdAt),
      indexedAt: timestamp,
    })
    .onConflict((oc) => oc.doNothing())
    .returningAll()
    .executeTakeFirst()
  return inserted || null
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

const updateAggregates = async (db: DatabaseSchema, follow: IndexedFollow) => {
  await db
    .insertInto('actor')
    .values({
      did: follow.subjectDid,
      indexedAt: follow.indexedAt,
      followersCount: db
        .selectFrom('follow')
        .where('subjectDid', '=', follow.subjectDid)
        .select(countAll.as('count')),
    })
    .onConflict((oc) =>
      oc.column('did').doUpdateSet({
        followersCount: excluded(db, 'followersCount'),
      }),
    )
    .execute()
}

export type PluginType = RecordProcessor<
  AppSokaaGraphFollow.Record,
  IndexedFollow
>

export const makePlugin = (db: Database): PluginType => {
  return new RecordProcessor(db, {
    lexId: ids.AppSokaaGraphFollow,
    validate: (obj) => {
      AppSokaaGraphFollow.validateRecord(obj)
    },
    insertFn,
    deleteFn,
    updateAggregates,
  })
}
