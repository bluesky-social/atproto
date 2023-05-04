import assert from 'assert'
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
      createdAt: obj.createdAt,
      indexedAt: timestamp,
    })
    .onConflict((oc) => oc.doNothing())
    .returningAll()
    .executeTakeFirst()
  if (!inserted) {
    return null
  }
  await updateEmbedsQb(db, [inserted.creator, inserted.subjectDid])
    .set({ blocked: 1 })
    .execute()
  await updateRepliesQb(db, [inserted.creator, inserted.subjectDid])
    .set({ replyBlocked: 1 })
    .execute()
  return inserted
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
  if (!deleted) {
    return null
  }
  const blockPair = [deleted.creator, deleted.subjectDid]
  const remainingBlock = await hasBlock(db, blockPair)
  if (!remainingBlock) {
    await updateEmbedsQb(db, blockPair).set({ blocked: 0 }).execute()
    await updateRepliesQb(db, blockPair).set({ replyBlocked: 0 }).execute()
  }
  return deleted
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

function updateEmbedsQb(db: DatabaseSchema, blockPair: string[]) {
  assert(blockPair.length === 2)
  return db
    .updateTable('post_embed_record as update_embed')
    .whereExists((qb) =>
      qb
        .selectFrom('post_embed_record as match_embed')
        .selectAll()
        .innerJoin('post', 'post.uri', 'match_embed.postUri')
        .innerJoin('post as embed', 'embed.uri', 'match_embed.embedUri')
        .whereRef('update_embed.postUri', '=', 'match_embed.postUri')
        .whereRef('update_embed.embedUri', '=', 'match_embed.embedUri')
        .where('post.creator', 'in', blockPair)
        .where('embed.creator', 'in', blockPair)
        .whereRef('post.creator', '!=', 'embed.creator'),
    )
}

function updateRepliesQb(db: DatabaseSchema, blockPair: string[]) {
  assert(blockPair.length === 2)
  return db
    .updateTable('post as update_post')
    .whereExists((qb) =>
      qb
        .selectFrom('post as match_reply')
        .selectAll()
        .innerJoin('post as parent', 'parent.uri', 'match_reply.replyParent')
        .whereRef('update_post.uri', '=', 'match_reply.uri')
        .where('match_reply.creator', 'in', blockPair)
        .where('parent.creator', 'in', blockPair)
        .whereRef('match_reply.creator', '!=', 'parent.creator'),
    )
}

export async function hasBlock(db: DatabaseSchema, blockPair: string[]) {
  assert(blockPair.length === 2)
  const block = await db
    .selectFrom('actor_block')
    .where('creator', 'in', blockPair)
    .where('subjectDid', 'in', blockPair)
    .whereRef('creator', '!=', 'subjectDid')
    .select('uri')
    .executeTakeFirst()
  return !!block
}
