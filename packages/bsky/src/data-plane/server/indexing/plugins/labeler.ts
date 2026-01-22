import { Selectable } from 'kysely'
import { Cid } from '@atproto/lex-data'
import { AtUri, normalizeDatetimeAlways } from '@atproto/syntax'
import { app } from '../../../../lexicons'
import { BackgroundQueue } from '../../background'
import { Database } from '../../db'
import { DatabaseSchema, DatabaseSchemaType } from '../../db/database-schema'
import { RecordProcessor } from '../processor'

type IndexedLabeler = Selectable<DatabaseSchemaType['labeler']>

const insertFn = async (
  db: DatabaseSchema,
  uri: AtUri,
  cid: Cid,
  obj: app.bsky.labeler.service.Main,
  timestamp: string,
): Promise<IndexedLabeler | null> => {
  if (uri.rkey !== 'self') return null
  const inserted = await db
    .insertInto('labeler')
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
): Promise<IndexedLabeler | null> => {
  const deleted = await db
    .deleteFrom('labeler')
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
    schema: app.bsky.labeler.service.main,
    insertFn,
    findDuplicate,
    deleteFn,
    notifsForInsert,
    notifsForDelete,
  })
}

export default makePlugin
