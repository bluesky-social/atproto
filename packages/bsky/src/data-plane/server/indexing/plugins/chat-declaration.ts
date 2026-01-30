import { Cid } from '@atproto/lex-data'
import { AtUri } from '@atproto/syntax'
import { chat } from '../../../../lexicons'
import { BackgroundQueue } from '../../background'
import { Database } from '../../db'
import { DatabaseSchema } from '../../db/database-schema'
import { RecordProcessor } from '../processor'

// @NOTE this indexer is a placeholder to ensure it gets indexed in the generic records table

const insertFn = async (
  _db: DatabaseSchema,
  uri: AtUri,
  _cid: Cid,
  _obj: unknown,
  _timestamp: string,
): Promise<unknown | null> => {
  if (uri.rkey !== 'self') return null
  return true
}

const findDuplicate = async (): Promise<AtUri | null> => {
  return null
}

const notifsForInsert = () => {
  return []
}

const deleteFn = async (
  _db: DatabaseSchema,
  uri: AtUri,
): Promise<unknown | null> => {
  if (uri.rkey !== 'self') return null
  return true
}

const notifsForDelete = () => {
  return { notifs: [], toDelete: [] }
}

export type PluginType = ReturnType<typeof makePlugin>
export const makePlugin = (db: Database, background: BackgroundQueue) => {
  const processor = new RecordProcessor(db, background, {
    schema: chat.bsky.actor.declaration.main,
    insertFn,
    findDuplicate,
    deleteFn,
    notifsForInsert,
    notifsForDelete,
  })
  // @TODO use lexicon validation
  processor.assertValidRecord = () => null
  return processor
}

export default makePlugin
