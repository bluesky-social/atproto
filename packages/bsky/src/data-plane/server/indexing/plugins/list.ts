import { Selectable } from 'kysely'
import { CID } from 'multiformats/cid'
import { AtUri, normalizeDatetimeAlways } from '@atproto/syntax'
import * as lex from '../../../../lexicon/lexicons'
import * as List from '../../../../lexicon/types/app/bsky/graph/list'
import { BackgroundQueue } from '../../background'
import { Database } from '../../db'
import { DatabaseSchema, DatabaseSchemaType } from '../../db/database-schema'
import { RecordProcessor } from '../processor'

const lexId = lex.ids.AppBskyGraphList
type IndexedList = Selectable<DatabaseSchemaType['list']>

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
      createdAt: normalizeDatetimeAlways(obj.createdAt),
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
