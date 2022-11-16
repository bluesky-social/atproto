import { Kysely } from 'kysely'
import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import * as Post from '../../lexicon/types/app/bsky/feed/post'
import * as PostTables from '../tables/post'
import * as schemas from '../schemas'
import * as messages from '../message-queue/messages'
import { Message } from '../message-queue/messages'
import DatabaseSchema from '../database-schema'
import RecordProcessor from '../record-processor'

type IndexedPost = {
  post: PostTables.Post
  entities: PostTables.PostEntity[]
}

const schemaId = schemas.ids.AppBskyFeedPost

const insertFn = async (
  db: Kysely<DatabaseSchema>,
  uri: AtUri,
  cid: CID,
  obj: Post.Record,
  timestamp?: string,
): Promise<IndexedPost | null> => {
  const entities = (obj.entities || []).map((entity) => ({
    postUri: uri.toString(),
    startIndex: entity.index.start,
    endIndex: entity.index.end,
    type: entity.type,
    value: entity.value,
  }))
  const post = {
    uri: uri.toString(),
    cid: cid.toString(),
    creator: uri.host,
    text: obj.text,
    createdAt: obj.createdAt,
    replyRoot: obj.reply?.root?.uri || null,
    replyRootCid: obj.reply?.root?.cid || null,
    replyParent: obj.reply?.parent?.uri || null,
    replyParentCid: obj.reply?.parent?.cid || null,
    indexedAt: timestamp || new Date().toISOString(),
  }
  const insertedPost = await db
    .insertInto('post')
    .values(post)
    .onConflict((oc) => oc.doNothing())
    .returningAll()
    .executeTakeFirst()
  let insertedEntities: PostTables.PostEntity[] = []
  if (entities.length > 0) {
    insertedEntities = await db
      .insertInto('post_entity')
      .values(entities)
      .returningAll()
      .execute()
  }
  return insertedPost
    ? { post: insertedPost, entities: insertedEntities }
    : null
}

const findDuplicate = async (): Promise<AtUri | null> => {
  return null
}

const eventsForInsert = (obj: IndexedPost): Message[] => {
  const notifs: Message[] = []
  for (const entity of obj.entities || []) {
    if (entity.type === 'mention') {
      notifs.push(
        messages.createNotification({
          userDid: entity.value,
          author: obj.post.creator,
          recordUri: obj.post.uri,
          recordCid: obj.post.cid,
          reason: 'mention',
        }),
      )
    }
  }
  if (obj.post.replyParent) {
    const parentUri = new AtUri(obj.post.replyParent)
    notifs.push(
      messages.createNotification({
        userDid: parentUri.host,
        author: obj.post.creator,
        recordUri: obj.post.uri,
        recordCid: obj.post.cid,
        reason: 'reply',
        reasonSubject: parentUri.toString(),
      }),
    )
  }
  return notifs
}

const deleteFn = async (
  db: Kysely<DatabaseSchema>,
  uri: AtUri,
): Promise<IndexedPost | null> => {
  const deleted = await db
    .deleteFrom('post')
    .where('uri', '=', uri.toString())
    .returningAll()
    .executeTakeFirst()
  const deletedEntities = await db
    .deleteFrom('post_entity')
    .where('postUri', '=', uri.toString())
    .returningAll()
    .execute()
  return deleted ? { post: deleted, entities: deletedEntities } : null
}

const eventsForDelete = (
  deleted: IndexedPost,
  replacedBy: IndexedPost | null,
): Message[] => {
  if (replacedBy) return []
  return [messages.deleteNotifications(deleted.post.uri)]
}

export type PluginType = RecordProcessor<Post.Record, IndexedPost>

export const makePlugin = (db: Kysely<DatabaseSchema>): PluginType => {
  return new RecordProcessor(db, {
    schemaId,
    insertFn,
    findDuplicate,
    deleteFn,
    eventsForInsert,
    eventsForDelete,
  })
}

export default makePlugin
