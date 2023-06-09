import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import * as ListItem from '../../../../lexicon/types/app/bsky/graph/listitem'
import * as lex from '../../../../lexicon/lexicons'
import Database from '../../../../db'
import {
  DatabaseSchema,
  DatabaseSchemaType,
} from '../../../../db/database-schema'
import { BackgroundQueue } from '../../../../event-stream/background-queue'
import RecordProcessor from '../processor'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { toSimplifiedISOSafe } from '../util'

const lexId = lex.ids.AppBskyGraphListitem
type IndexedListItem = DatabaseSchemaType['list_item']

const insertFn = async (
  db: DatabaseSchema,
  uri: AtUri,
  cid: CID,
  obj: ListItem.Record,
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
  uri: AtUri,
  obj: ListItem.Record,
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

const notifsForDelete = (
  deleted: IndexedListItem,
  replacedBy: IndexedListItem | null,
) => {
  const toDelete = replacedBy ? [] : [deleted.uri]
  return { notifs: [], toDelete }
}

export type PluginType = RecordProcessor<ListItem.Record, IndexedListItem>

export const makePlugin = (
  db: Database,
  backgroundQueue: BackgroundQueue,
): PluginType => {
  return new RecordProcessor(db, backgroundQueue, {
    lexId,
    insertFn,
    findDuplicate,
    deleteFn,
    notifsForInsert,
    notifsForDelete,
  })
}

export default makePlugin
