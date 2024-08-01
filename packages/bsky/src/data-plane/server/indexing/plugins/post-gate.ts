import { AtUri, normalizeDatetimeAlways } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { CID } from 'multiformats/cid'
import * as PostGate from '../../../../lexicon/types/app/bsky/feed/postgate'
import * as lex from '../../../../lexicon/lexicons'
import { DatabaseSchema, DatabaseSchemaType } from '../../db/database-schema'
import { Database } from '../../db'
import RecordProcessor from '../processor'
import { BackgroundQueue } from '../../background'

const lexId = lex.ids.AppBskyFeedThreadgate
type IndexedGate = DatabaseSchemaType['post_gate']

const insertFn = async (
  db: DatabaseSchema,
  uri: AtUri,
  cid: CID,
  obj: PostGate.Record,
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
  return inserted || null
}

const findDuplicate = async (
  db: DatabaseSchema,
  _uri: AtUri,
  obj: PostGate.Record,
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
  return deleted || null
}

const notifsForDelete = () => {
  return { notifs: [], toDelete: [] }
}

export type PluginType = RecordProcessor<PostGate.Record, IndexedGate>

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
