import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import * as FeedGenerator from '../../../../lexicon/types/app/bsky/feed/generator'
import * as lex from '../../../../lexicon/lexicons'
import Database from '../../../../db'
import {
  DatabaseSchema,
  DatabaseSchemaType,
} from '../../../../db/database-schema'
import { BackgroundQueue } from '../../../../event-stream/background-queue'
import RecordProcessor from '../processor'

const lexId = lex.ids.AppBskyFeedGenerator
type IndexedFeedGenerator = DatabaseSchemaType['feed_generator']

const insertFn = async (
  db: DatabaseSchema,
  uri: AtUri,
  cid: CID,
  obj: FeedGenerator.Record,
  timestamp: string,
): Promise<IndexedFeedGenerator | null> => {
  const inserted = await db
    .insertInto('feed_generator')
    .values({
      uri: uri.toString(),
      cid: cid.toString(),
      creator: uri.host,
      feedDid: obj.did,
      displayName: obj.displayName,
      description: obj.description,
      descriptionFacets: obj.descriptionFacets
        ? JSON.stringify(obj.descriptionFacets)
        : undefined,
      avatarCid: obj.avatar?.ref.toString(),
      createdAt: obj.createdAt,
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
): Promise<IndexedFeedGenerator | null> => {
  const deleted = await db
    .deleteFrom('feed_generator')
    .where('uri', '=', uri.toString())
    .returningAll()
    .executeTakeFirst()
  return deleted || null
}

const notifsForDelete = () => {
  return { notifs: [], toDelete: [] }
}

export type PluginType = RecordProcessor<
  FeedGenerator.Record,
  IndexedFeedGenerator
>

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
