import { AtUri } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { CID } from 'multiformats/cid'
import * as Detach from '../../../../lexicon/types/app/bsky/feed/detach'
import * as lex from '../../../../lexicon/lexicons'
import { DatabaseSchema, DatabaseSchemaType } from '../../db/database-schema'
import { Database } from '../../db'
import RecordProcessor from '../processor'
import { BackgroundQueue } from '../../background'

const lexId = lex.ids.AppBskyFeedDetach
type IndexedDetach = DatabaseSchemaType['detach']

const insertFn = async (
  db: DatabaseSchema,
  uri: AtUri,
  _cid: CID,
  obj: Detach.Record,
  timestamp: string,
): Promise<IndexedDetach | null> => {
  const postUri = new AtUri(obj.post)
  if (postUri.host !== uri.host || postUri.rkey !== uri.rkey) {
    throw new InvalidRequestError(
      'Creator and rkey of detach record does not match its associated post',
    )
  }
  const inserted = await db
    .insertInto('detach')
    .values({
      uri: uri.toString(),
      post: obj.post,
      targets: obj.targets,
      updatedAt: timestamp,
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
): Promise<IndexedDetach | null> => {
  const deleted = await db
    .deleteFrom('detach')
    .where('post', '=', uri.toString())
    .returningAll()
    .executeTakeFirst()
  return deleted || null
}

const notifsForDelete = () => {
  return { notifs: [], toDelete: [] }
}

export type PluginType = RecordProcessor<Detach.Record, IndexedDetach>

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
