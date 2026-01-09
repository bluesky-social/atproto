import { Cid as Cid } from '@atproto/lex-data'
import { AtUri } from '@atproto/syntax'
import { app } from '../../../../lexicons'
import { BackgroundQueue } from '../../background'
import { Database } from '../../db'
import { DatabaseSchema } from '../../db/database-schema'
import { RecordProcessor } from '../processor'

// @NOTE this indexer is a placeholder to ensure it gets indexed in the generic records table

const lexId = app.bsky.actor.status.$type

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

export type PluginType = RecordProcessor<unknown, unknown>

export const makePlugin = (
  db: Database,
  background: BackgroundQueue,
): PluginType => {
  const processor = new RecordProcessor(db, background, {
    lexId,
    insertFn,
    findDuplicate,
    deleteFn,
    notifsForInsert,
    notifsForDelete,
  })
  return processor
}

export default makePlugin
