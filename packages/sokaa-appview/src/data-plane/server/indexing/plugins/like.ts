import { Selectable } from 'kysely'
import { CID } from 'multiformats/cid'
import { AppSokaaFeedLike } from '@atproto/api'
import { AtUri } from '@atproto/syntax'
import { Database } from '../../db'
import { DatabaseSchema, DatabaseSchemaType } from '../../db/database-schema'
import { countAll } from '../../db/util'
import { ids } from '../collections'
import { RecordProcessor } from '../processor'
import { normalizeCreatedAt } from '../sanitizers'

type IndexedLike = Selectable<DatabaseSchemaType['like']>

const insertFn = async (
  db: DatabaseSchema,
  uri: AtUri,
  cid: CID,
  obj: AppSokaaFeedLike.Record,
  timestamp: string,
): Promise<IndexedLike | null> => {
  const inserted = await db
    .insertInto('like')
    .values({
      uri: uri.toString(),
      creator: uri.host,
      subject: obj.subject.uri,
      subjectCid: obj.subject.cid,
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
): Promise<IndexedLike | null> => {
  const deleted = await db
    .deleteFrom('like')
    .where('uri', '=', uri.toString())
    .returningAll()
    .executeTakeFirst()
  return deleted || null
}

const updateAggregates = async (db: DatabaseSchema, like: IndexedLike) => {
  await db
    .updateTable('post')
    .set({
      likeCount: db
        .selectFrom('like')
        .where('subject', '=', like.subject)
        .select(countAll.as('count')),
    })
    .where('uri', '=', like.subject)
    .execute()
}

export type PluginType = RecordProcessor<AppSokaaFeedLike.Record, IndexedLike>

export const makePlugin = (db: Database): PluginType => {
  return new RecordProcessor(db, {
    lexId: ids.AppSokaaFeedLike,
    validate: (obj) => {
      AppSokaaFeedLike.validateRecord(obj)
    },
    insertFn,
    deleteFn,
    updateAggregates,
  })
}
