import { Cid } from '@atproto/lex'
import { AtUri } from '@atproto/syntax'
import { com } from '../../../../lexicons/index.js'
import { BackgroundQueue } from '../../background.js'
import { DatabaseSchema } from '../../db/database-schema.js'
import { Database } from '../../db/index.js'
import { RecordProcessor } from '../processor.js'

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
export const makePlugin = (
  db: Database,
  background: BackgroundQueue<Database>,
) => {
  return new RecordProcessor(db, background, {
    schema: com.germnetwork.declaration.main,
    insertFn,
    findDuplicate,
    deleteFn,
    notifsForInsert,
    notifsForDelete,
  })
}

export default makePlugin
