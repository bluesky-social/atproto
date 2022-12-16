import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import * as Declaration from '../../../lexicon/types/app/bsky/system/declaration'
import * as lex from '../../../lexicon/lexicons'
import { Message } from '../../../event-stream/messages'
import { DatabaseSchema, DatabaseSchemaType } from '../../../db/database-schema'
import RecordProcessor from '../processor'

const lexId = lex.ids.AppBskySystemDeclaration
type DidHandle = DatabaseSchemaType['did_handle']

const insertFn = async (
  db: DatabaseSchema,
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

export const makePlugin = (db: DatabaseSchema): PluginType => {
  return new RecordProcessor(db, {
    lexId,
    insertFn,
    findDuplicate,
    deleteFn,
    eventsForInsert,
    eventsForDelete,
  })
}

export default makePlugin
