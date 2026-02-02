import { Insertable, Selectable, sql } from 'kysely'
import { $Typed, lexParse } from '@atproto/lex'
import { Cid } from '@atproto/lex-data'
import { AtUri, normalizeDatetimeAlways } from '@atproto/syntax'
import { app } from '../../../../lexicons'
import {
  postUriToPostgateUri,
  postUriToThreadgateUri,
  uriToDid,
} from '../../../../util/uris'
import { RecordWithMedia } from '../../../../views/types'
import { parsePostgate } from '../../../../views/util'
import { BackgroundQueue } from '../../background'
import { Database } from '../../db'
import { DatabaseSchema, DatabaseSchemaType } from '../../db/database-schema'
import { Notification } from '../../db/tables/notification'
import { countAll, excluded } from '../../db/util'
import {
  getAncestorsAndSelfQb,
  getDescendentsQb,
  invalidReplyRoot as checkInvalidReplyRoot,
  violatesThreadGate as checkViolatesThreadGate,
} from '../../util'
import { RecordProcessor } from '../processor'

type Notif = Insertable<Notification>
type Post = Selectable<DatabaseSchemaType['post']>
type PostEmbedImage = DatabaseSchemaType['post_embed_image']
type PostEmbedExternal = DatabaseSchemaType['post_embed_external']
type PostEmbedRecord = DatabaseSchemaType['post_embed_record']
type PostEmbedVideo = DatabaseSchemaType['post_embed_video']
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
  embeds?: (
    | PostEmbedImage[]
    | PostEmbedExternal
    | PostEmbedRecord
    | PostEmbedVideo
  )[]
  ancestors?: PostAncestor[]
  descendents?: PostDescendent[]
  threadgate?: app.bsky.feed.threadgate.Main
}

const REPLY_NOTIF_DEPTH = 5

const insertFn = async (
  db: DatabaseSchema,
  uri: AtUri,
  cid: Cid,
  obj: app.bsky.feed.post.Main,
  timestamp: string,
): Promise<IndexedPost | null> => {
  const post = {
    uri: uri.toString(),
    cid: cid.toString(),
    creator: uri.host,
    text: obj.text,
    createdAt: normalizeDatetimeAlways(obj.createdAt),
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
      Object.assign(insertedPost, { invalidReplyRoot, violatesThreadGate })
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
      if (app.bsky.richtext.facet.mention.$matches(feature)) {
        return {
          type: 'mention' as const,
          value: feature.did,
        }
      }
      if (app.bsky.richtext.facet.link.$matches(feature)) {
        return {
          type: 'link' as const,
          value: feature.uri,
        }
      }
      return []
    })
  // Embed indices
  const embeds: (
    | PostEmbedImage[]
    | PostEmbedExternal
    | PostEmbedRecord
    | PostEmbedVideo
  )[] = []
  const postEmbeds = separateEmbeds(obj.embed)
  for (const postEmbed of postEmbeds) {
    if (app.bsky.embed.images.$matches(postEmbed)) {
      const { images } = postEmbed
      const imagesEmbed = images.map((img, i) => ({
        postUri: uri.toString(),
        position: i,
        imageCid: img.image.ref.toString(),
        alt: img.alt,
      }))
      embeds.push(imagesEmbed)
      await db.insertInto('post_embed_image').values(imagesEmbed).execute()
    } else if (app.bsky.embed.external.$matches(postEmbed)) {
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
    } else if (app.bsky.embed.record.$matches(postEmbed)) {
      const { record } = postEmbed
      const embedUri = new AtUri(record.uri)
      const recordEmbed = {
        postUri: uri.toString(),
        embedUri: record.uri,
        embedCid: record.cid,
      }
      embeds.push(recordEmbed)
      await db.insertInto('post_embed_record').values(recordEmbed).execute()

      if (embedUri.collection === app.bsky.feed.post.$type) {
        const quote = {
          uri: uri.toString(),
          cid: cid.toString(),
          subject: record.uri,
          subjectCid: record.cid,
          createdAt: normalizeDatetimeAlways(obj.createdAt),
          indexedAt: timestamp,
        }
        await db
          .insertInto('quote')
          .values(quote)
          .onConflict((oc) => oc.doNothing())
          .returningAll()
          .executeTakeFirst()

        const quoteCountQb = db
          .insertInto('post_agg')
          .values({
            uri: record.uri.toString(),
            quoteCount: db
              .selectFrom('quote')
              .where('quote.subjectCid', '=', record.cid.toString())
              .select(countAll.as('count')),
          })
          .onConflict((oc) =>
            oc
              .column('uri')
              .doUpdateSet({ quoteCount: excluded(db, 'quoteCount') }),
          )
        await quoteCountQb.execute()

        const { violatesEmbeddingRules } = await validatePostEmbed(
          db,
          embedUri.toString(),
          uri.toString(),
        )
        Object.assign(insertedPost, {
          violatesEmbeddingRules: violatesEmbeddingRules,
        })
        if (violatesEmbeddingRules) {
          await db
            .updateTable('post')
            .where('uri', '=', insertedPost.uri)
            .set({ violatesEmbeddingRules: violatesEmbeddingRules })
            .executeTakeFirst()
        }
      }
    } else if (app.bsky.embed.video.$matches(postEmbed)) {
      const { video } = postEmbed
      const videoEmbed = {
        postUri: uri.toString(),
        videoCid: video.ref.toString(),
        // @NOTE: alt is required for image but not for video on the lexicon.
        alt: postEmbed.alt ?? null,
      }
      embeds.push(videoEmbed)

      await db.insertInto('post_embed_video').values(videoEmbed).execute()
    }
  }

  const threadgate = await getThreadgateRecord(db, post.replyRoot || post.uri)
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
    threadgate,
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

  if (!obj.post.violatesEmbeddingRules) {
    for (const embed of obj.embeds ?? []) {
      if ('embedUri' in embed) {
        const embedUri = new AtUri(embed.embedUri)
        if (embedUri.collection === app.bsky.feed.post.$type) {
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
  }

  if (obj.post.violatesThreadGate) {
    // don't generate reply notifications when post violates threadgate
    return notifs
  }

  const threadgateHiddenReplies = obj.threadgate?.hiddenReplies || []

  // reply notifications

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
      // found hidden reply, don't notify any higher ancestors
      if (threadgateHiddenReplies.includes(ancestorUri.toString())) break
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
  await db.deleteFrom('quote').where('subject', '=', uriStr).execute()
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
    const embedUri = new AtUri(deletedPosts.embedUri)
    deletedEmbeds.push(deletedPosts)

    if (embedUri.collection === app.bsky.feed.post.$type) {
      await db.deleteFrom('quote').where('uri', '=', uriStr).execute()
      await db
        .insertInto('post_agg')
        .values({
          uri: deletedPosts.embedUri,
          quoteCount: db
            .selectFrom('quote')
            .where('quote.subjectCid', '=', deletedPosts.embedCid.toString())
            .select(countAll.as('count')),
        })
        .onConflict((oc) =>
          oc
            .column('uri')
            .doUpdateSet({ quoteCount: excluded(db, 'quoteCount') }),
        )
        .execute()
    }
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
            .where((qb) =>
              qb
                .where('post.violatesThreadGate', 'is', null)
                .orWhere('post.violatesThreadGate', '=', false),
            )
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

export type PluginType = ReturnType<typeof makePlugin>
export const makePlugin = (db: Database, background: BackgroundQueue) => {
  return new RecordProcessor(db, background, {
    schema: app.bsky.feed.post.main,
    insertFn,
    findDuplicate,
    deleteFn,
    notifsForInsert,
    notifsForDelete,
    updateAggregates,
  })
}

export default makePlugin

function separateEmbeds(
  embed: app.bsky.feed.post.Main['embed'],
): Array<
  | RecordWithMedia['media']
  | $Typed<RecordWithMedia['record']>
  | NonNullable<app.bsky.feed.post.Main['embed']>
> {
  if (!embed) {
    return []
  }
  if (app.bsky.embed.recordWithMedia.$matches(embed)) {
    return [app.bsky.embed.record.$build(embed.record), embed.media]
  }
  return [embed]
}

async function validateReply(
  db: DatabaseSchema,
  creator: string,
  reply: app.bsky.feed.post.ReplyRef,
) {
  const replyRefs = await getReplyRefs(db, reply)
  // check reply
  const invalidReplyRoot =
    !replyRefs.parent || checkInvalidReplyRoot(reply, replyRefs.parent)
  // check interaction
  const violatesThreadGate = await checkViolatesThreadGate(
    db,
    creator,
    uriToDid(reply.root.uri),
    replyRefs.root?.record ?? null,
    replyRefs.gate?.record ?? null,
  )
  return {
    invalidReplyRoot,
    violatesThreadGate,
  }
}

async function getThreadgateRecord(db: DatabaseSchema, postUri: string) {
  const threadgateRecordUri = postUriToThreadgateUri(postUri)
  const results = await db
    .selectFrom('record')
    .where('record.uri', '=', threadgateRecordUri)
    .selectAll()
    .execute()
  const threadgateRecord = results.find(
    (ref) => ref.uri === threadgateRecordUri,
  )
  if (threadgateRecord) {
    return lexParse<app.bsky.feed.threadgate.Main>(threadgateRecord.json)
  }
}

async function validatePostEmbed(
  db: DatabaseSchema,
  embedUri: string,
  parentUri: string,
) {
  const postgateRecordUri = postUriToPostgateUri(embedUri)
  const postgateRecord = await db
    .selectFrom('record')
    .where('record.uri', '=', postgateRecordUri)
    .selectAll()
    .executeTakeFirst()
  if (!postgateRecord) {
    return {
      violatesEmbeddingRules: false,
    }
  }
  const {
    embeddingRules: { canEmbed },
  } = parsePostgate({
    gate: lexParse<app.bsky.feed.postgate.Main>(postgateRecord.json),
    viewerDid: uriToDid(parentUri),
    authorDid: uriToDid(embedUri),
  })
  if (canEmbed) {
    return {
      violatesEmbeddingRules: false,
    }
  }
  return {
    violatesEmbeddingRules: true,
  }
}

async function getReplyRefs(
  db: DatabaseSchema,
  reply: app.bsky.feed.post.ReplyRef,
) {
  const replyRoot = reply.root.uri
  const replyParent = reply.parent.uri
  const replyGate = postUriToThreadgateUri(replyRoot)
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
      record: lexParse<app.bsky.feed.post.Main>(root.json),
    },
    parent: parent && {
      uri: parent.uri,
      invalidReplyRoot: parent.invalidReplyRoot,
      record: lexParse<app.bsky.feed.post.Main>(parent.json),
    },
    gate: gate && {
      uri: gate.uri,
      record: lexParse<app.bsky.feed.threadgate.Main>(gate.json),
    },
  }
}
