import { Selectable } from 'kysely'
import { Cid as Cid } from '@atproto/lex-data'
import { AtUri, normalizeDatetimeAlways } from '@atproto/syntax'
import { app } from '../../../../lexicons'
import { BackgroundQueue } from '../../background'
import { Database } from '../../db'
import { DatabaseSchema, DatabaseSchemaType } from '../../db/database-schema'
import { RecordProcessor } from '../processor'

type IndexedStarterPack = Selectable<DatabaseSchemaType['starter_pack']>

const insertFn = async (
  db: DatabaseSchema,
  uri: AtUri,
  cid: Cid,
  obj: app.bsky.graph.starterpack.Main,
  timestamp: string,
): Promise<IndexedStarterPack | null> => {
  const inserted = await db
    .insertInto('starter_pack')
    .values({
      uri: uri.toString(),
      cid: cid.toString(),
      creator: uri.host,
      name: obj.name,
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

export type PluginType = ReturnType<typeof makePlugin>
export const makePlugin = (db: Database, background: BackgroundQueue) => {
  return new RecordProcessor(db, background, {
    schema: app.bsky.graph.starterpack.main,
    insertFn,
    findDuplicate,
    deleteFn,
    notifsForInsert,
    notifsForDelete,
  })
}

export default makePlugin
