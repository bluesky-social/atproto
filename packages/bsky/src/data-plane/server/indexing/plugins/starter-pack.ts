import { Selectable } from 'kysely'
import { AtUri, normalizeDatetimeAlways } from '@atproto/syntax'
import { CID } from 'multiformats/cid'
import * as StarterPack from '../../../../lexicon/types/app/bsky/graph/starterpack'
import * as lex from '../../../../lexicon/lexicons'
import { Database } from '../../db'
import { DatabaseSchema, DatabaseSchemaType } from '../../db/database-schema'
import RecordProcessor from '../processor'
import { BackgroundQueue } from '../../background'

const lexId = lex.ids.AppBskyGraphStarterpack
type IndexedStarterPack = Selectable<DatabaseSchemaType['starter_pack']>

const insertFn = async (
  db: DatabaseSchema,
  uri: AtUri,
  cid: CID,
  obj: StarterPack.Record,
  timestamp: string,
): Promise<IndexedStarterPack | null> => {
  const inserted = await db
    .insertInto('starter_pack')
    .values({
      uri: uri.toString(),
      cid: cid.toString(),
      creator: uri.host,
      createdAt: normalizeDatetimeAlways(obj.createdAt),
      indexedAt: timestamp,
    })
    .onConflict((oc) => oc.doNothing())
    .returningAll()
    .executeTakeFirst()
  return inserted || null
}

const findDuplicate = async (): Promise<AtUri | null> => {
  return null
}

const notifsForInsert = () => {
  return []
}

const deleteFn = async (
  db: DatabaseSchema,
  uri: AtUri,
): Promise<IndexedStarterPack | null> => {
  const deleted = await db
    .deleteFrom('starter_pack')
    .where('uri', '=', uri.toString())
    .returningAll()
    .executeTakeFirst()
  return deleted || null
}

const notifsForDelete = () => {
  return { notifs: [], toDelete: [] }
}

export type PluginType = RecordProcessor<StarterPack.Record, IndexedStarterPack>

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
  })
}

export default makePlugin
