import { AtUri } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { toSimplifiedISOSafe } from '@atproto/common'
import { CID } from 'multiformats/cid'
import * as Threadgate from '../../../lexicon/types/app/bsky/feed/threadgate'
import * as lex from '../../../lexicon/lexicons'
import { DatabaseSchema, DatabaseSchemaType } from '../../../db/database-schema'
import RecordProcessor from '../processor'
import { PrimaryDatabase } from '../../../db'
import { BackgroundQueue } from '../../../background'
import { NotificationServer } from '../../../notifications'

const lexId = lex.ids.AppBskyFeedThreadgate
type IndexedGate = DatabaseSchemaType['thread_gate']

const insertFn = async (
  db: DatabaseSchema,
  uri: AtUri,
  cid: CID,
  obj: Threadgate.Record,
  timestamp: string,
): Promise<IndexedGate | null> => {
  const postUri = new AtUri(obj.post)
  if (postUri.host !== uri.host || postUri.rkey !== uri.rkey) {
    throw new InvalidRequestError(
      'Creator and rkey of thread gate does not match its post',
    )
  }
  const inserted = await db
    .insertInto('thread_gate')
    .values({
      uri: uri.toString(),
      cid: cid.toString(),
      creator: uri.host,
      postUri: obj.post,
      createdAt: toSimplifiedISOSafe(obj.createdAt),
      indexedAt: timestamp,
    })
    .onConflict((oc) => oc.doNothing())
    .returningAll()
    .executeTakeFirst()
  return inserted || null
}

const findDuplicate = async (
  db: DatabaseSchema,
  _uri: AtUri,
  obj: Threadgate.Record,
): Promise<AtUri | null> => {
  const found = await db
    .selectFrom('thread_gate')
    .where('postUri', '=', obj.post)
    .selectAll()
    .executeTakeFirst()
  return found ? new AtUri(found.uri) : null
}

const notifsForInsert = () => {
  return []
}

const deleteFn = async (
  db: DatabaseSchema,
  uri: AtUri,
): Promise<IndexedGate | null> => {
  const deleted = await db
    .deleteFrom('thread_gate')
    .where('uri', '=', uri.toString())
    .returningAll()
    .executeTakeFirst()
  return deleted || null
}

const notifsForDelete = () => {
  return { notifs: [], toDelete: [] }
}

export type PluginType = RecordProcessor<Threadgate.Record, IndexedGate>

export const makePlugin = (
  db: PrimaryDatabase,
  backgroundQueue: BackgroundQueue,
  notifServer?: NotificationServer,
): PluginType => {
  return new RecordProcessor(db, backgroundQueue, notifServer, {
    lexId,
    insertFn,
    findDuplicate,
    deleteFn,
    notifsForInsert,
    notifsForDelete,
  })
}

export default makePlugin
