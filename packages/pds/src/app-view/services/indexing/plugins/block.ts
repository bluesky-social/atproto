import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import * as Block from '../../../../lexicon/types/app/bsky/graph/block'
import * as lex from '../../../../lexicon/lexicons'
import Database from '../../../../db'
import {
  DatabaseSchema,
  DatabaseSchemaType,
} from '../../../../db/database-schema'
import { BackgroundQueue } from '../../../../event-stream/background-queue'
import RecordProcessor from '../processor'
import { toSimplifiedISOSafe } from '../util'

const lexId = lex.ids.AppBskyGraphBlock
type IndexedBlock = DatabaseSchemaType['actor_block']

const insertFn = async (
  db: DatabaseSchema,
  uri: AtUri,
  cid: CID,
  obj: Block.Record,
  timestamp: string,
): Promise<IndexedBlock | null> => {
  const inserted = await db
    .insertInto('actor_block')
    .values({
      uri: uri.toString(),
      cid: cid.toString(),
      creator: uri.host,
      subjectDid: obj.subject,
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
  obj: Block.Record,
): Promise<AtUri | null> => {
  const found = await db
    .selectFrom('actor_block')
    .where('creator', '=', uri.host)
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
): Promise<IndexedBlock | null> => {
  const deleted = await db
    .deleteFrom('actor_block')
    .where('uri', '=', uri.toString())
    .returningAll()
    .executeTakeFirst()
  return deleted || null
}

const notifsForDelete = (
  deleted: IndexedBlock,
  replacedBy: IndexedBlock | null,
) => {
  const toDelete = replacedBy ? [] : [deleted.uri]
  return { notifs: [], toDelete }
}

const updateAggregates = async () => {}

export type PluginType = RecordProcessor<Block.Record, IndexedBlock>

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
    updateAggregates,
  })
}

export default makePlugin
