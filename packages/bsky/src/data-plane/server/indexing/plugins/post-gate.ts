import { CID } from 'multiformats/cid'
import { AtUri, normalizeDatetimeAlways } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import * as lex from '../../../../lexicon/lexicons'
import * as Postgate from '../../../../lexicon/types/app/bsky/feed/postgate'
import { BackgroundQueue } from '../../background'
import { Database } from '../../db'
import { DatabaseSchema, DatabaseSchemaType } from '../../db/database-schema'
import { RecordProcessor } from '../processor'

const lexId = lex.ids.AppBskyFeedPostgate
type IndexedGate = DatabaseSchemaType['post_gate']

const insertFn = async (
  db: DatabaseSchema,
  uri: AtUri,
  cid: CID,
  obj: Postgate.Record,
  timestamp: string,
): Promise<IndexedGate | null> => {
  const postUri = new AtUri(obj.post)
  if (postUri.host !== uri.host || postUri.rkey !== uri.rkey) {
    throw new InvalidRequestError(
      'Creator and rkey of post gate does not match its post',
    )
  }
  const inserted = await db
    .insertInto('post_gate')
    .values({
      uri: uri.toString(),
      cid: cid.toString(),
      creator: uri.host,
      postUri: obj.post,
      createdAt: normalizeDatetimeAlways(obj.createdAt),
      indexedAt: timestamp,
    })
    .onConflict((oc) => oc.doNothing())
    .returningAll()
    .executeTakeFirst()
  await db
    .updateTable('post')
    .where('uri', '=', postUri.toString())
    .set({ hasPostGate: true })
    .executeTakeFirst()
  return inserted || null
}

const findDuplicate = async (
  db: DatabaseSchema,
  _uri: AtUri,
  obj: Postgate.Record,
): Promise<AtUri | null> => {
  const found = await db
    .selectFrom('post_gate')
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
    .deleteFrom('post_gate')
    .where('uri', '=', uri.toString())
    .returningAll()
    .executeTakeFirst()
  if (deleted) {
    await db
      .updateTable('post')
      .where('uri', '=', deleted.postUri)
      .set({ hasPostGate: false })
      .executeTakeFirst()
  }
  return deleted || null
}

const notifsForDelete = () => {
  return { notifs: [], toDelete: [] }
}

export type PluginType = RecordProcessor<Postgate.Record, IndexedGate>

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
