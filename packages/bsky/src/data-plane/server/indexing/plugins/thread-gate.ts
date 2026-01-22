import { Cid as Cid } from '@atproto/lex-data'
import { AtUri, normalizeDatetimeAlways } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { app } from '../../../../lexicons'
import { BackgroundQueue } from '../../background'
import { Database } from '../../db'
import { DatabaseSchema, DatabaseSchemaType } from '../../db/database-schema'
import { RecordProcessor } from '../processor'

type IndexedGate = DatabaseSchemaType['thread_gate']

const insertFn = async (
  db: DatabaseSchema,
  uri: AtUri,
  cid: Cid,
  obj: app.bsky.feed.threadgate.Main,
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
      createdAt: normalizeDatetimeAlways(obj.createdAt),
      indexedAt: timestamp,
    })
    .onConflict((oc) => oc.doNothing())
    .returningAll()
    .executeTakeFirst()
  await db
    .updateTable('post')
    .where('uri', '=', postUri.toString())
    .set({ hasThreadGate: true })
    .executeTakeFirst()
  return inserted || null
}

const findDuplicate = async (
  db: DatabaseSchema,
  _uri: AtUri,
  obj: app.bsky.feed.threadgate.Main,
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
  if (deleted) {
    await db
      .updateTable('post')
      .where('uri', '=', deleted.postUri)
      .set({ hasThreadGate: false })
      .executeTakeFirst()
  }
  return deleted || null
}

const notifsForDelete = () => {
  return { notifs: [], toDelete: [] }
}

export type PluginType = ReturnType<typeof makePlugin>
export const makePlugin = (db: Database, background: BackgroundQueue) => {
  return new RecordProcessor(db, background, {
    schema: app.bsky.feed.threadgate.main,
    insertFn,
    findDuplicate,
    deleteFn,
    notifsForInsert,
    notifsForDelete,
  })
}

export default makePlugin
