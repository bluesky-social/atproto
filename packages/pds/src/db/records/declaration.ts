import { Kysely } from 'kysely'
import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import * as Declaration from '../../lexicon/types/app/bsky/system/declaration'
import * as schemas from '../schemas'
import { DidHandle } from '../tables/did-handle'
import { Message } from '../message-queue/messages'
import RecordProcessor from '../record-processor'
import DatabaseSchema from '../database-schema'

const schemaId = schemas.ids.AppBskySystemDeclaration

const insertFn = async (
  db: Kysely<DatabaseSchema>,
  uri: AtUri,
  cid: CID,
  obj: Declaration.Record,
  _timestamp?: string,
): Promise<DidHandle | null> => {
  if (uri.rkey !== 'self') return null
  const updated = await db
    .updateTable('did_handle')
    .where('did', '=', uri.host)
    .set({ declarationCid: cid.toString(), actorType: obj.actorType })
    .returningAll()
    .executeTakeFirst()
  return updated || null
}

const findDuplicate = async (): Promise<AtUri | null> => {
  return null
}

const eventsForInsert = (): Message[] => {
  return []
}

const deleteFn = async (): Promise<DidHandle | null> => {
  throw new Error('Declaration alone can not be deleted')
}

const eventsForDelete = (): Message[] => {
  return []
}

export type PluginType = RecordProcessor<Declaration.Record, DidHandle>

export const makePlugin = (db: Kysely<DatabaseSchema>): PluginType => {
  return new RecordProcessor(db, {
    schemaId,
    insertFn,
    findDuplicate,
    deleteFn,
    eventsForInsert,
    eventsForDelete,
  })
}

export default makePlugin
