import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import * as ListBlock from '../../../../lexicon/types/app/bsky/graph/listblock'
import * as lex from '../../../../lexicon/lexicons'
import Database from '../../../../db'
import {
  DatabaseSchema,
  DatabaseSchemaType,
} from '../../../../db/database-schema'
import { BackgroundQueue } from '../../../../event-stream/background-queue'
import RecordProcessor from '../processor'

const lexId = lex.ids.AppBskyGraphListblock
type IndexedListBlock = DatabaseSchemaType['list_block']

const insertFn = async (
  db: DatabaseSchema,
  uri: AtUri,
  cid: CID,
  obj: ListBlock.Record,
  timestamp: string,
): Promise<IndexedListBlock | null> => {
  const inserted = await db
    .insertInto('list_block')
    .values({
      uri: uri.toString(),
      cid: cid.toString(),
      creator: uri.host,
      subjectUri: obj.subject,
      createdAt: obj.createdAt,
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
  obj: ListBlock.Record,
): Promise<AtUri | null> => {
  const found = await db
    .selectFrom('list_block')
    .where('creator', '=', uri.host)
    .where('subjectUri', '=', obj.subject)
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
): Promise<IndexedListBlock | null> => {
  const deleted = await db
    .deleteFrom('list_block')
    .where('uri', '=', uri.toString())
    .returningAll()
    .executeTakeFirst()
  return deleted || null
}

const notifsForDelete = (
  deleted: IndexedListBlock,
  replacedBy: IndexedListBlock | null,
) => {
  const toDelete = replacedBy ? [] : [deleted.uri]
  return { notifs: [], toDelete }
}

export type PluginType = RecordProcessor<ListBlock.Record, IndexedListBlock>

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
