import { Selectable, sql } from 'kysely'
import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/uri'
import { Record as PostRecord } from '../../../lexicon/types/app/bsky/feed/post'
import { isMain as isEmbedImage } from '../../../lexicon/types/app/bsky/embed/images'
import { isMain as isEmbedExternal } from '../../../lexicon/types/app/bsky/embed/external'
import { isMain as isEmbedRecord } from '../../../lexicon/types/app/bsky/embed/record'
import { isMain as isEmbedRecordWithMedia } from '../../../lexicon/types/app/bsky/embed/recordWithMedia'
import {
  isMention,
  isLink,
} from '../../../lexicon/types/app/bsky/richtext/facet'
import * as lex from '../../../lexicon/lexicons'
import * as messages from '../messages'
import { Message } from '../messages'
import { DatabaseSchema, DatabaseSchemaType } from '../../../db/database-schema'
import RecordProcessor from '../processor'
import { PostHierarchy } from '../../../db/tables/post-hierarchy'

type Post = Selectable<DatabaseSchemaType['post']>
type PostEmbedImage = DatabaseSchemaType['post_embed_image']
type PostEmbedExternal = DatabaseSchemaType['post_embed_external']
type PostEmbedRecord = DatabaseSchemaType['post_embed_record']
type IndexedPost = {
  post: Post
  facets?: { type: 'mention' | 'link'; value: string }[]
  embeds?: (PostEmbedImage[] | PostEmbedExternal | PostEmbedRecord)[]
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
  const facets = (obj.facets || [])
    .flatMap((facet) => facet.features)
    .flatMap((feature) => {
      if (isMention(feature)) {
        return {
          type: 'mention' as const,
          value: feature.did,
        }
      }
      if (isLink(feature)) {
        return {
          type: 'link' as const,
          value: feature.uri,
        }
      }
      return []
    })
  // Embed indices
  const embeds: (PostEmbedImage[] | PostEmbedExternal | PostEmbedRecord)[] = []
  const postEmbeds = separateEmbeds(obj.embed)
  for (const postEmbed of postEmbeds) {
    if (isEmbedImage(postEmbed)) {
      const { images } = postEmbed
      const imagesEmbed = images.map((img, i) => ({
        postUri: uri.toString(),
        position: i,
        imageCid: img.image.ref.toString(),
        alt: img.alt,
      }))
      embeds.push(imagesEmbed)
      await db.insertInto('post_embed_image').values(imagesEmbed).execute()
    } else if (isEmbedExternal(postEmbed)) {
      const { external } = postEmbed
      const externalEmbed = {
        postUri: uri.toString(),
        uri: external.uri,
        title: external.title,
        description: external.description,
        thumbCid: external.thumb?.ref.toString() || null,
      }
      embeds.push(externalEmbed)
      await db.insertInto('post_embed_external').values(externalEmbed).execute()
    } else if (isEmbedRecord(postEmbed)) {
      const { record } = postEmbed
      const recordEmbed = {
        postUri: uri.toString(),
        embedUri: record.uri,
        embedCid: record.cid,
      }
      embeds.push(recordEmbed)
      await db.insertInto('post_embed_record').values(recordEmbed).execute()
    }
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
  const minimalPostHierarchy = [
    {
      uri: post.uri,
      ancestorUri: post.uri,
      depth: 0,
    },
  ]
  if (post.replyParent) {
    minimalPostHierarchy.push({
      uri: post.uri,
      ancestorUri: post.replyParent,
      depth: 1,
    })
  }
  const ancestors = await db
    .insertInto('post_hierarchy')
    .values(minimalPostHierarchy)
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
    facets,
    embeds,
    ancestors,
    descendents: await collateDescendents(db, descendents),
  }
  // return { post: insertedPost, facets, embeds, ancestors }
}

const findDuplicate = async (): Promise<AtUri | null> => {
  return null
}

const eventsForInsert = (obj: IndexedPost) => {
  const notifs: Message[] = []
  const notified = new Set([obj.post.creator])
  const maybeNotify = (notif: messages.NotificationInfo) => {
    if (!notified.has(notif.userDid)) {
      notified.add(notif.userDid)
      notifs.push(messages.createNotification(notif))
    }
  }
  for (const facet of obj.facets ?? []) {
    if (facet.type === 'mention') {
      maybeNotify({
        userDid: facet.value,
        reason: 'mention',
        author: obj.post.creator,
        recordUri: obj.post.uri,
        recordCid: obj.post.cid,
      })
    }
  }
  for (const embed of obj.embeds ?? []) {
    if ('embedUri' in embed) {
      const embedUri = new AtUri(embed.embedUri)
      if (embedUri.collection === lex.ids.AppBskyFeedPost) {
        maybeNotify({
          userDid: embedUri.host,
          reason: 'quote',
          reasonSubject: embedUri.toString(),
          author: obj.post.creator,
          recordUri: obj.post.uri,
          recordCid: obj.post.cid,
        })
      }
    }
  }

  const ancestors = (obj.ancestors ?? [])
    .filter((a) => a.depth > 0) // no need to notify self
    .sort((a, b) => a.depth - b.depth)
  for (const relation of ancestors) {
    const ancestorUri = new AtUri(relation.ancestorUri)
    maybeNotify({
      userDid: ancestorUri.host,
      reason: 'reply',
      reasonSubject: ancestorUri.toString(),
      author: obj.post.creator,
      recordUri: obj.post.uri,
      recordCid: obj.post.cid,
    })
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
  const deletedEmbeds: (
    | PostEmbedImage[]
    | PostEmbedExternal
    | PostEmbedRecord
  )[] = []
  const [deletedImgs, deletedExternals, deletedPosts] = await Promise.all([
    db
      .deleteFrom('post_embed_image')
      .where('postUri', '=', uri.toString())
      .returningAll()
      .execute(),
    db
      .deleteFrom('post_embed_external')
      .where('postUri', '=', uri.toString())
      .returningAll()
      .executeTakeFirst(),
    db
      .deleteFrom('post_embed_record')
      .where('postUri', '=', uri.toString())
      .returningAll()
      .executeTakeFirst(),
  ])
  if (deletedImgs.length) {
    deletedEmbeds.push(deletedImgs)
  }
  if (deletedExternals) {
    deletedEmbeds.push(deletedExternals)
  }
  if (deletedPosts) {
    deletedEmbeds.push(deletedPosts)
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
        facets: [], // Not used
        embeds: deletedEmbeds,
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

function separateEmbeds(embed: PostRecord['embed']) {
  if (!embed) {
    return []
  }
  if (isEmbedRecordWithMedia(embed)) {
    return [{ $type: lex.ids.AppBskyEmbedRecord, ...embed.record }, embed.media]
  }
  return [embed]
}

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
