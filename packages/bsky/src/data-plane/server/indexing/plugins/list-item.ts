import { Selectable } from 'kysely'
import { Cid } from '@atproto/lex-data'
import { AtUri, normalizeDatetimeAlways } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { app } from '../../../../lexicons'
import { BackgroundQueue } from '../../background'
import { Database } from '../../db'
import { DatabaseSchema, DatabaseSchemaType } from '../../db/database-schema'
import { RecordProcessor } from '../processor'

type IndexedListItem = Selectable<DatabaseSchemaType['list_item']>

const insertFn = async (
  db: DatabaseSchema,
  uri: AtUri,
  cid: Cid,
  obj: app.bsky.graph.listitem.Main,
  timestamp: string,
): Promise<IndexedListItem | null> => {
  const listUri = new AtUri(obj.list)
  if (listUri.hostname !== uri.hostname) {
    throw new InvalidRequestError(
      'Creator of listitem does not match creator of list',
    )
  }
  const inserted = await db
    .insertInto('list_item')
    .values({
      uri: uri.toString(),
      cid: cid.toString(),
      creator: uri.host,
      subjectDid: obj.subject,
      listUri: obj.list,
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
  obj: app.bsky.graph.listitem.Main,
): Promise<AtUri | null> => {
  const found = await db
    .selectFrom('list_item')
    .where('listUri', '=', obj.list)
    .where('subjectDid', '=', obj.subject)
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
): Promise<IndexedListItem | null> => {
  const deleted = await db
    .deleteFrom('list_item')
    .where('uri', '=', uri.toString())
    .returningAll()
    .executeTakeFirst()
  return deleted || null
}

const notifsForDelete = () => {
  return { notifs: [], toDelete: [] }
}

export type PluginType = ReturnType<typeof makePlugin>
export const makePlugin = (db: Database, background: BackgroundQueue) => {
  return new RecordProcessor(db, background, {
    schema: app.bsky.graph.listitem.main,
    insertFn,
    findDuplicate,
    deleteFn,
    notifsForInsert,
    notifsForDelete,
  })
}

export default makePlugin
