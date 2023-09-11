import { AtUri } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { CID } from 'multiformats/cid'
import * as Gate from '../../../lexicon/types/app/bsky/feed/gate'
import * as lex from '../../../lexicon/lexicons'
import { DatabaseSchema, DatabaseSchemaType } from '../../../db/database-schema'
import RecordProcessor from '../processor'
import { toSimplifiedISOSafe } from '../util'
import { PrimaryDatabase } from '../../../db'
import { BackgroundQueue } from '../../../background'
import { NotificationServer } from '../../../notifications'

const lexId = lex.ids.AppBskyFeedGate
type IndexedGate = DatabaseSchemaType['gate']

const insertFn = async (
  db: DatabaseSchema,
  uri: AtUri,
  cid: CID,
  obj: Gate.Record,
  timestamp: string,
): Promise<IndexedGate | null> => {
  const postUri = new AtUri(obj.post)
  if (postUri.host !== uri.host || postUri.rkey !== uri.rkey) {
    throw new InvalidRequestError(
      'Creator and rkey of gate does not match its post',
    )
  }
  const inserted = await db
    .insertInto('gate')
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
  obj: Gate.Record,
): Promise<AtUri | null> => {
  const found = await db
    .selectFrom('gate')
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
    .deleteFrom('gate')
    .where('uri', '=', uri.toString())
    .returningAll()
    .executeTakeFirst()
  return deleted || null
}

const notifsForDelete = () => {
  return { notifs: [], toDelete: [] }
}

export type PluginType = RecordProcessor<Gate.Record, IndexedGate>

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
