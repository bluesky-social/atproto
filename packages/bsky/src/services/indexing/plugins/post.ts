import { sql } from 'kysely'
import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/uri'
import { Record as PostRecord } from '../../../lexicon/types/app/bsky/feed/post'
import { isMain as isEmbedImage } from '../../../lexicon/types/app/bsky/embed/images'
import { isMain as isEmbedExternal } from '../../../lexicon/types/app/bsky/embed/external'
import { isMain as isEmbedRecord } from '../../../lexicon/types/app/bsky/embed/record'
import * as lex from '../../../lexicon/lexicons'
import { DatabaseSchema, DatabaseSchemaType } from '../../../db/database-schema'
import { PostHierarchy } from '../../../db/tables/post-hierarchy'
import * as messages from '../messages'
import { Message } from '../messages'
import RecordProcessor from '../processor'

type Post = DatabaseSchemaType['post']
type PostEntity = DatabaseSchemaType['post_entity']
type PostEmbedImage = DatabaseSchemaType['post_embed_image']
type PostEmbedExternal = DatabaseSchemaType['post_embed_external']
type PostEmbedRecord = DatabaseSchemaType['post_embed_record']
type IndexedPost = {
  post: Post
  entities?: PostEntity[]
  embed?: PostEmbedImage[] | PostEmbedExternal | PostEmbedRecord
  ancestors?: PostHierarchy[]
  descendents?: IndexedPost[]
}

const lexId = lex.ids.AppBskyFeedPost

const insertFn = async (
  db: DatabaseSchema,
  uri: AtUri,
  cid: CID,
  obj: PostRecord,
  timestamp: string,
): Promise<IndexedPost | null> => {
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
    indexedAt: timestamp,
  }
  const insertedPost = await db
    .insertInto('post')
    .values(post)
    .onConflict((oc) => oc.doNothing())
    .returningAll()
    .executeTakeFirst()
  if (!insertedPost) {
    return null // Post already indexed
  }
  const entities = (obj.entities || []).map((entity) => ({
    postUri: uri.toString(),
    startIndex: entity.index.start,
    endIndex: entity.index.end,
    type: entity.type,
    value: entity.value,
  }))
  // Entity and embed indices
  let insertedEntities: PostEntity[] | undefined
  if (entities.length > 0) {
    insertedEntities = await db
      .insertInto('post_entity')
      .values(entities)
      .returningAll()
      .execute()
  }
  let embed: PostEmbedImage[] | PostEmbedExternal | PostEmbedRecord | undefined
  if (isEmbedImage(obj.embed)) {
    const { images } = obj.embed
    embed = images.map((img, i) => ({
      postUri: uri.toString(),
      position: i,
      imageCid: img.image.cid,
      alt: img.alt,
    }))
    await db.insertInto('post_embed_image').values(embed).execute()
  } else if (isEmbedExternal(obj.embed)) {
    const { external } = obj.embed
    embed = {
      postUri: uri.toString(),
      uri: external.uri,
      title: external.title,
      description: external.description,
      thumbCid: external.thumb?.cid || null,
    }
    await db.insertInto('post_embed_external').values(embed).execute()
  } else if (isEmbedRecord(obj.embed)) {
    const { record } = obj.embed
    embed = {
      postUri: uri.toString(),
      embedUri: record.uri,
      embedCid: record.cid,
    }
    await db.insertInto('post_embed_record').values(embed).execute()
  }

  // Thread indexing

  // Concurrent, out-of-order updates are difficult, so we essentially
  // take a lock on the thread for indexing, by locking the thread's root post.
  await db
    .selectFrom('post')
    .forUpdate()
    .selectAll()
    .where('uri', '=', post.replyRoot ?? post.uri)
    .execute()

  // Track the minimum we know about the post hierarchy: the post and its parent.
  // Importantly, this works even if the parent hasn't been indexed yet.
  const ancestors = await db
    .insertInto('post_hierarchy')
    .values([
      {
        uri: post.uri,
        ancestorUri: post.uri,
        depth: 0,
      },
      ...(post.replyParent
        ? [
            {
              uri: post.uri,
              ancestorUri: post.replyParent,
              depth: 1,
            },
          ]
        : []),
    ])
    .onConflict((oc) => oc.doNothing())
    .returningAll()
    .execute()

  // Copy all the parent's relations down to the post.
  // It's possible that the parent hasn't been indexed yet and this will no-op.
  if (post.replyParent) {
    const deepAncestors = await db
      .insertInto('post_hierarchy')
      .columns(['uri', 'ancestorUri', 'depth'])
      .expression(
        db
          .selectFrom('post_hierarchy as parent_hierarchy')
          .where('parent_hierarchy.uri', '=', post.replyParent)
          .select([
            sql`${post.uri}`.as('uri'),
            'ancestorUri',
            sql`depth + 1`.as('depth'),
          ]),
      )
      .onConflict((oc) => oc.doNothing())
      .returningAll()
      .execute()
    ancestors.push(...deepAncestors)
  }

  // Copy all post's relations down to its descendents. This ensures
  // that out-of-order indexing (i.e. descendent before parent) is resolved.
  const descendents = await db
    .insertInto('post_hierarchy')
    .columns(['uri', 'ancestorUri', 'depth'])
    .expression(
      db
        .selectFrom('post_hierarchy as target')
        .innerJoin(
          'post_hierarchy as source',
          'source.ancestorUri',
          'target.uri',
        )
        .where('target.uri', '=', post.uri)
        .select([
          'source.uri as uri',
          'target.ancestorUri as ancestorUri',
          sql`source.depth + target.depth`.as('depth'),
        ]),
    )
    .onConflict((oc) => oc.doNothing())
    .returningAll()
    .execute()

  return {
    post: insertedPost,
    entities: insertedEntities,
    embed,
    ancestors,
    descendents: await collateDescendents(db, descendents),
  }
}

const findDuplicate = async (): Promise<AtUri | null> => {
  return null
}

const eventsForInsert = (obj: IndexedPost) => {
  const notifs: Message[] = []
  for (const entity of obj.entities || []) {
    if (entity.type === 'mention') {
      if (entity.value !== obj.post.creator) {
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
  }
  const notified = new Set([obj.post.creator])
  const ancestors = [...(obj.ancestors ?? [])].sort((a, b) => a.depth - b.depth)
  for (const relation of ancestors) {
    if (relation.depth < 1) {
      continue // no need to notify self
    }
    const ancestorUri = new AtUri(relation.ancestorUri)
    if (!notified.has(ancestorUri.host)) {
      notified.add(ancestorUri.host)
      notifs.push(
        messages.createNotification({
          userDid: ancestorUri.host,
          author: obj.post.creator,
          recordUri: obj.post.uri,
          recordCid: obj.post.cid,
          reason: 'reply',
          reasonSubject: ancestorUri.toString(),
        }),
      )
    }
  }

  if (obj.descendents) {
    // May generate notifications for out-of-order indexing of replies
    for (const descendent of obj.descendents) {
      notifs.push(...eventsForInsert(descendent))
    }
  }

  return notifs
}

const deleteFn = async (
  db: DatabaseSchema,
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
  let deletedEmbed:
    | PostEmbedImage[]
    | PostEmbedExternal
    | PostEmbedRecord
    | undefined
  const deletedImgs = await db
    .deleteFrom('post_embed_image')
    .where('postUri', '=', uri.toString())
    .returningAll()
    .execute()
  deletedEmbed = deletedImgs.length ? deletedImgs : undefined
  if (!deletedEmbed) {
    const deletedExternals = await db
      .deleteFrom('post_embed_external')
      .where('postUri', '=', uri.toString())
      .returningAll()
      .executeTakeFirst()
    deletedEmbed = deletedExternals
  }
  if (!deletedEmbed) {
    const deletedPosts = await db
      .deleteFrom('post_embed_record')
      .where('postUri', '=', uri.toString())
      .returningAll()
      .executeTakeFirst()
    deletedEmbed = deletedPosts
  }
  // Do not delete, maintain thread hierarchy even if post no longer exists
  const ancestors = await db
    .selectFrom('post_hierarchy')
    .where('uri', '=', uri.toString())
    .where('depth', '>', 0)
    .selectAll()
    .execute()
  return deleted
    ? {
        post: deleted,
        entities: deletedEntities,
        embed: deletedEmbed,
        ancestors,
      }
    : null
}

const eventsForDelete = (
  deleted: IndexedPost,
  replacedBy: IndexedPost | null,
): Message[] => {
  const replacedNotifications = replacedBy ? eventsForInsert(replacedBy) : []
  return [
    messages.deleteNotifications(deleted.post.uri),
    ...replacedNotifications,
  ]
}

export type PluginType = RecordProcessor<PostRecord, IndexedPost>

export const makePlugin = (db: DatabaseSchema): PluginType => {
  return new RecordProcessor(db, {
    lexId,
    insertFn,
    findDuplicate,
    deleteFn,
    eventsForInsert,
    eventsForDelete,
  })
}

export default makePlugin

async function collateDescendents(
  db: DatabaseSchema,
  descendents: PostHierarchy[],
): Promise<IndexedPost[] | undefined> {
  if (!descendents.length) return

  const ancestorsByUri = descendents.reduce((acc, descendent) => {
    acc[descendent.uri] ??= []
    acc[descendent.uri].push(descendent)
    return acc
  }, {} as Record<string, PostHierarchy[]>)

  const descendentPosts = await db
    .selectFrom('post')
    .selectAll()
    .where('uri', 'in', Object.keys(ancestorsByUri))
    .execute()

  return descendentPosts.map((post) => {
    return {
      post,
      ancestors: ancestorsByUri[post.uri],
    }
  })
}
