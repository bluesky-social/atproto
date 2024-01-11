import { Selectable } from 'kysely'
import { AtUri, normalizeDatetimeAlways } from '@atproto/syntax'
import { CID } from 'multiformats/cid'
import * as ModService from '../../../../lexicon/types/app/bsky/moderation/service'
import * as lex from '../../../../lexicon/lexicons'
import { Database } from '../../db'
import { DatabaseSchema, DatabaseSchemaType } from '../../db/database-schema'
import RecordProcessor from '../processor'
import { BackgroundQueue } from '../../background'

const lexId = lex.ids.AppBskyModerationService
type IndexedModService = Selectable<DatabaseSchemaType['mod_service']>

const insertFn = async (
  db: DatabaseSchema,
  uri: AtUri,
  cid: CID,
  obj: ModService.Record,
  timestamp: string,
): Promise<IndexedModService | null> => {
  const inserted = await db
    .insertInto('mod_service')
    .values({
      uri: uri.toString(),
      cid: cid.toString(),
      creator: uri.host,
      serviceDid: obj.did,
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
): Promise<IndexedModService | null> => {
  const deleted = await db
    .deleteFrom('mod_service')
    .where('uri', '=', uri.toString())
    .returningAll()
    .executeTakeFirst()
  return deleted || null
}

const notifsForDelete = () => {
  return { notifs: [], toDelete: [] }
}

export type PluginType = RecordProcessor<ModService.Record, IndexedModService>

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
