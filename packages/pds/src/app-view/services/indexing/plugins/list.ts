import { AtUri } from '@atproto/syntax'
import { CID } from 'multiformats/cid'
import * as List from '../../../../lexicon/types/app/bsky/graph/list'
import * as lex from '../../../../lexicon/lexicons'
import Database from '../../../../db'
import {
  DatabaseSchema,
  DatabaseSchemaType,
} from '../../../../db/database-schema'
import { BackgroundQueue } from '../../../../event-stream/background-queue'
import RecordProcessor from '../processor'
import { toSimplifiedISOSafe } from '../util'

const lexId = lex.ids.AppBskyGraphList
type IndexedList = DatabaseSchemaType['list']

const insertFn = async (
  db: DatabaseSchema,
  uri: AtUri,
  cid: CID,
  obj: List.Record,
  timestamp: string,
): Promise<IndexedList | null> => {
  const inserted = await db
    .insertInto('list')
    .values({
      uri: uri.toString(),
      cid: cid.toString(),
      creator: uri.host,
      name: obj.name,
      purpose: obj.purpose,
      description: obj.description,
      descriptionFacets: obj.descriptionFacets
        ? JSON.stringify(obj.descriptionFacets)
        : undefined,
      avatarCid: obj.avatar?.ref.toString(),
      createdAt: toSimplifiedISOSafe(obj.createdAt),
      indexedAt: timestamp,
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
): Promise<IndexedList | null> => {
  const deleted = await db
    .deleteFrom('list')
    .where('uri', '=', uri.toString())
    .returningAll()
    .executeTakeFirst()
  return deleted || null
}

const notifsForDelete = () => {
  return { notifs: [], toDelete: [] }
}

export type PluginType = RecordProcessor<List.Record, IndexedList>

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
