import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/syntax'
import * as lex from '../../../../lexicon/lexicons'
import { BackgroundQueue } from '../../background'
import { Database } from '../../db'
import { DatabaseSchema } from '../../db/database-schema'
import { RecordProcessor } from '../processor'

// @NOTE this indexer is a placeholder to ensure it gets indexed in the generic records table

const lexId = lex.ids.ChatBskyActorDeclaration

const insertFn = async (
  _db: DatabaseSchema,
  uri: AtUri,
  _cid: CID,
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
  // @TODO use lexicon validation
  processor.assertValidRecord = () => null
  return processor
}

export default makePlugin
