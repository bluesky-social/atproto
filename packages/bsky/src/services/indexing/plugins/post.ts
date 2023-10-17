import { Insertable, Selectable, sql } from 'kysely'
import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/syntax'
import { toSimplifiedISOSafe } from '@atproto/common'
import { jsonStringToLex } from '@atproto/lexicon'
import {
  Record as PostRecord,
  ReplyRef,
} from '../../../lexicon/types/app/bsky/feed/post'
import { Record as GateRecord } from '../../../lexicon/types/app/bsky/feed/threadgate'
import { isMain as isEmbedImage } from '../../../lexicon/types/app/bsky/embed/images'
import { isMain as isEmbedExternal } from '../../../lexicon/types/app/bsky/embed/external'
import { isMain as isEmbedRecord } from '../../../lexicon/types/app/bsky/embed/record'
import { isMain as isEmbedRecordWithMedia } from '../../../lexicon/types/app/bsky/embed/recordWithMedia'
import {
  isMention,
  isLink,
} from '../../../lexicon/types/app/bsky/richtext/facet'
import * as lex from '../../../lexicon/lexicons'
import { DatabaseSchema, DatabaseSchemaType } from '../../../db/database-schema'
import RecordProcessor from '../processor'
import { Notification } from '../../../db/tables/notification'
import { PrimaryDatabase } from '../../../db'
import { countAll, excluded } from '../../../db/util'
import { BackgroundQueue } from '../../../background'
import { getAncestorsAndSelfQb, getDescendentsQb } from '../../util/post'
import { NotificationServer } from '../../../notifications'
import * as feedutil from '../../feed/util'
import { postToThreadgateUri } from '../../feed/util'

type Notif = Insertable<Notification>
type Post = Selectable<DatabaseSchemaType['post']>
type PostEmbedImage = DatabaseSchemaType['post_embed_image']
type PostEmbedExternal = DatabaseSchemaType['post_embed_external']
type PostEmbedRecord = DatabaseSchemaType['post_embed_record']
type PostAncestor = {
  uri: string
  height: number
}
type PostDescendent = {
  uri: string
  depth: number
  cid: string
  creator: string
  sortAt: string
}
type IndexedPost = {
  post: Post
  facets?: { type: 'mention' | 'link'; value: string }[]
  embeds?: (PostEmbedImage[] | PostEmbedExternal | PostEmbedRecord)[]
  ancestors?: PostAncestor[]
  descendents?: PostDescendent[]
}

const lexId = lex.ids.AppBskyFeedPost

const REPLY_NOTIF_DEPTH = 5

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
    createdAt: toSimplifiedISOSafe(obj.createdAt),
    replyRoot: obj.reply?.root?.uri || null,
    replyRootCid: obj.reply?.root?.cid || null,
    replyParent: obj.reply?.parent?.uri || null,
    replyParentCid: obj.reply?.parent?.cid || null,
    langs: obj.langs?.length
      ? sql<string[]>`${JSON.stringify(obj.langs)}` // sidesteps kysely's array serialization, which is non-jsonb
      : null,
    tags: obj.tags?.length
      ? sql<string[]>`${JSON.stringify(obj.tags)}` // sidesteps kysely's array serialization, which is non-jsonb
      : null,
    indexedAt: timestamp,
  }
  const [insertedPost] = await Promise.all([
    db
      .insertInto('post')
      .values(post)
      .onConflict((oc) => oc.doNothing())
      .returningAll()
      .executeTakeFirst(),
    db
      .insertInto('feed_item')
      .values({
        type: 'post',
        uri: post.uri,
        cid: post.cid,
        postUri: post.uri,
        originatorDid: post.creator,
        sortAt:
          post.indexedAt < post.createdAt ? post.indexedAt : post.createdAt,
      })
      .onConflict((oc) => oc.doNothing())
      .executeTakeFirst(),
  ])
  if (!insertedPost) {
    return null // Post already indexed
  }

  if (obj.reply) {
    const { invalidReplyRoot, violatesThreadGate } = await validateReply(
      db,
      uri.host,
      obj.reply,
    )
    if (invalidReplyRoot || violatesThreadGate) {
      await db
        .updateTable('post')
        .where('uri', '=', post.uri)
        .set({ invalidReplyRoot, violatesThreadGate })
        .executeTakeFirst()
    }
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

  const ancestors = await getAncestorsAndSelfQb(db, {
    uri: post.uri,
    parentHeight: REPLY_NOTIF_DEPTH,
  })
    .selectFrom('ancestor')
    .selectAll()
    .execute()
  const descendents = await getDescendentsQb(db, {
    uri: post.uri,
    depth: REPLY_NOTIF_DEPTH,
  })
    .selectFrom('descendent')
    .innerJoin('post', 'post.uri', 'descendent.uri')
    .selectAll('descendent')
    .select(['cid', 'creator', 'sortAt'])
    .execute()
  return {
    post: insertedPost,
    facets,
    embeds,
    ancestors,
    descendents,
  }
}

const findDuplicate = async (): Promise<AtUri | null> => {
  return null
}

const notifsForInsert = (obj: IndexedPost) => {
  const notifs: Notif[] = []
  const notified = new Set([obj.post.creator])
  const maybeNotify = (notif: Notif) => {
    if (!notified.has(notif.did)) {
      notified.add(notif.did)
      notifs.push(notif)
    }
  }
  for (const facet of obj.facets ?? []) {
    if (facet.type === 'mention') {
      maybeNotify({
        did: facet.value,
        reason: 'mention',
        author: obj.post.creator,
        recordUri: obj.post.uri,
        recordCid: obj.post.cid,
        sortAt: obj.post.sortAt,
      })
    }
  }
  for (const embed of obj.embeds ?? []) {
    if ('embedUri' in embed) {
      const embedUri = new AtUri(embed.embedUri)
      if (embedUri.collection === lex.ids.AppBskyFeedPost) {
        maybeNotify({
          did: embedUri.host,
          reason: 'quote',
          reasonSubject: embedUri.toString(),
          author: obj.post.creator,
          recordUri: obj.post.uri,
          recordCid: obj.post.cid,
          sortAt: obj.post.sortAt,
        })
      }
    }
  }

  for (const ancestor of obj.ancestors ?? []) {
    if (ancestor.uri === obj.post.uri) continue // no need to notify for own post
    if (ancestor.height < REPLY_NOTIF_DEPTH) {
      const ancestorUri = new AtUri(ancestor.uri)
      maybeNotify({
        did: ancestorUri.host,
        reason: 'reply',
        reasonSubject: ancestorUri.toString(),
        author: obj.post.creator,
        recordUri: obj.post.uri,
        recordCid: obj.post.cid,
        sortAt: obj.post.sortAt,
      })
    }
  }

  // descendents indicate out-of-order indexing: need to notify
  // the current post and upwards.
  for (const descendent of obj.descendents ?? []) {
    for (const ancestor of obj.ancestors ?? []) {
      const totalHeight = descendent.depth + ancestor.height
      if (totalHeight < REPLY_NOTIF_DEPTH) {
        const ancestorUri = new AtUri(ancestor.uri)
        maybeNotify({
          did: ancestorUri.host,
          reason: 'reply',
          reasonSubject: ancestorUri.toString(),
          author: descendent.creator,
          recordUri: descendent.uri,
          recordCid: descendent.cid,
          sortAt: descendent.sortAt,
        })
      }
    }
  }

  return notifs
}

const deleteFn = async (
  db: DatabaseSchema,
  uri: AtUri,
): Promise<IndexedPost | null> => {
  const uriStr = uri.toString()
  const [deleted] = await Promise.all([
    db
      .deleteFrom('post')
      .where('uri', '=', uriStr)
      .returningAll()
      .executeTakeFirst(),
    db.deleteFrom('feed_item').where('postUri', '=', uriStr).executeTakeFirst(),
  ])
  const deletedEmbeds: (
    | PostEmbedImage[]
    | PostEmbedExternal
    | PostEmbedRecord
  )[] = []
  const [deletedImgs, deletedExternals, deletedPosts] = await Promise.all([
    db
      .deleteFrom('post_embed_image')
      .where('postUri', '=', uriStr)
      .returningAll()
      .execute(),
    db
      .deleteFrom('post_embed_external')
      .where('postUri', '=', uriStr)
      .returningAll()
      .executeTakeFirst(),
    db
      .deleteFrom('post_embed_record')
      .where('postUri', '=', uriStr)
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
  return deleted
    ? {
        post: deleted,
        facets: [], // Not used
        embeds: deletedEmbeds,
      }
    : null
}

const notifsForDelete = (
  deleted: IndexedPost,
  replacedBy: IndexedPost | null,
) => {
  const notifs = replacedBy ? notifsForInsert(replacedBy) : []
  return {
    notifs,
    toDelete: [deleted.post.uri],
  }
}

const updateAggregates = async (db: DatabaseSchema, postIdx: IndexedPost) => {
  const replyCountQb = postIdx.post.replyParent
    ? db
        .insertInto('post_agg')
        .values({
          uri: postIdx.post.replyParent,
          replyCount: db
            .selectFrom('post')
            .where('post.replyParent', '=', postIdx.post.replyParent)
            .select(countAll.as('count')),
        })
        .onConflict((oc) =>
          oc
            .column('uri')
            .doUpdateSet({ replyCount: excluded(db, 'replyCount') }),
        )
    : null
  const postsCountQb = db
    .insertInto('profile_agg')
    .values({
      did: postIdx.post.creator,
      postsCount: db
        .selectFrom('post')
        .where('post.creator', '=', postIdx.post.creator)
        .select(countAll.as('count')),
    })
    .onConflict((oc) =>
      oc.column('did').doUpdateSet({ postsCount: excluded(db, 'postsCount') }),
    )
  await Promise.all([replyCountQb?.execute(), postsCountQb.execute()])
}

export type PluginType = RecordProcessor<PostRecord, IndexedPost>

export const makePlugin = (
  db: PrimaryDatabase,
  backgroundQueue: BackgroundQueue,
  notifServer?: NotificationServer,
): PluginType => {
  return new RecordProcessor(db, backgroundQueue, notifServer, {
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

function separateEmbeds(embed: PostRecord['embed']) {
  if (!embed) {
    return []
  }
  if (isEmbedRecordWithMedia(embed)) {
    return [{ $type: lex.ids.AppBskyEmbedRecord, ...embed.record }, embed.media]
  }
  return [embed]
}

async function validateReply(
  db: DatabaseSchema,
  creator: string,
  reply: ReplyRef,
) {
  const replyRefs = await getReplyRefs(db, reply)
  // check reply
  const invalidReplyRoot =
    !replyRefs.parent || feedutil.invalidReplyRoot(reply, replyRefs.parent)
  // check interaction
  const violatesThreadGate = await feedutil.violatesThreadGate(
    db,
    creator,
    new AtUri(reply.root.uri).host,
    replyRefs.root?.record ?? null,
    replyRefs.gate?.record ?? null,
  )
  return {
    invalidReplyRoot,
    violatesThreadGate,
  }
}

async function getReplyRefs(db: DatabaseSchema, reply: ReplyRef) {
  const replyRoot = reply.root.uri
  const replyParent = reply.parent.uri
  const replyGate = postToThreadgateUri(replyRoot)
  const results = await db
    .selectFrom('record')
    .where('record.uri', 'in', [replyRoot, replyGate, replyParent])
    .leftJoin('post', 'post.uri', 'record.uri')
    .selectAll('post')
    .select(['record.uri', 'json'])
    .execute()
  const root = results.find((ref) => ref.uri === replyRoot)
  const parent = results.find((ref) => ref.uri === replyParent)
  const gate = results.find((ref) => ref.uri === replyGate)
  return {
    root: root && {
      uri: root.uri,
      invalidReplyRoot: root.invalidReplyRoot,
      record: jsonStringToLex(root.json) as PostRecord,
    },
    parent: parent && {
      uri: parent.uri,
      invalidReplyRoot: parent.invalidReplyRoot,
      record: jsonStringToLex(parent.json) as PostRecord,
    },
    gate: gate && {
      uri: gate.uri,
      record: jsonStringToLex(gate.json) as GateRecord,
    },
  }
}
