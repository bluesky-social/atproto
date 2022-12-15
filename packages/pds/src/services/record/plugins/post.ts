import { Kysely } from 'kysely'
import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import { Record as PostRecord } from '../../../lexicon/types/app/bsky/feed/post'
import { Main as ImagesEmbedFragment } from '../../../lexicon/types/app/bsky/embed/images'
import { Main as ExternalEmbedFragment } from '../../../lexicon/types/app/bsky/embed/external'
import * as lex from '../../../lexicon/lexicons'
import * as messages from '../../../event-stream/messages'
import { Message } from '../../../event-stream/messages'
import DatabaseSchema from '../../../db/database-schema'
import RecordProcessor from '../processor'

type Post = DatabaseSchema['post']
type PostEntity = DatabaseSchema['post_entity']
type PostEmbedImage = DatabaseSchema['post_embed_image']
type PostEmbedExternal = DatabaseSchema['post_embed_external']
type IndexedPost = {
  post: Post
  entities: PostEntity[]
  embed?: PostEmbedImage[] | PostEmbedExternal
}

const lexId = lex.ids.AppBskyFeedPost

const insertFn = async (
  db: Kysely<DatabaseSchema>,
  uri: AtUri,
  cid: CID,
  obj: PostRecord,
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
  let insertedEntities: PostEntity[] = []
  if (entities.length > 0) {
    insertedEntities = await db
      .insertInto('post_entity')
      .values(entities)
      .returningAll()
      .execute()
  }
  let embed: PostEmbedImage[] | PostEmbedExternal | undefined
  if (obj.embed) {
    if (obj.embed.$type === 'app.bsky.embed.images') {
      embed = (obj.embed as ImagesEmbedFragment).images.map((img, i) => ({
        postUri: uri.toString(),
        position: i,
        imageCid: img.image.cid,
        alt: img.alt,
      }))
      await db.insertInto('post_embed_image').values(embed).execute()
    } else if (obj.embed.$type === 'app.bsky.embed.external') {
      const external = (obj.embed as ExternalEmbedFragment).external
      embed = {
        postUri: uri.toString(),
        uri: external.uri,
        title: external.title,
        description: external.description,
        thumbCid: external.thumb?.cid || null,
      }
      await db.insertInto('post_embed_external').values(embed).execute()
    }
  }
  return insertedPost
    ? { post: insertedPost, entities: insertedEntities, embed }
    : null
}

const findDuplicate = async (): Promise<AtUri | null> => {
  return null
}

const eventsForInsert = (obj: IndexedPost): Message[] => {
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
  if (obj.post.replyParent) {
    const parentUri = new AtUri(obj.post.replyParent)
    if (parentUri.host !== obj.post.creator) {
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
  let deletedEmbed: PostEmbedImage[] | PostEmbedExternal | undefined
  const deletedImgs = await db
    .deleteFrom('post_embed_image')
    .where('postUri', '=', uri.toString())
    .returningAll()
    .execute()
  if (deletedImgs) {
    deletedEmbed = deletedImgs
  } else {
    const deletedExternals = await db
      .deleteFrom('post_embed_external')
      .where('postUri', '=', uri.toString())
      .returningAll()
      .executeTakeFirst()
    deletedEmbed = deletedExternals || undefined
  }
  return deleted
    ? { post: deleted, entities: deletedEntities, embed: deletedEmbed }
    : null
}

const eventsForDelete = (
  deleted: IndexedPost,
  replacedBy: IndexedPost | null,
): Message[] => {
  if (replacedBy) return []
  return [messages.deleteNotifications(deleted.post.uri)]
}

export type PluginType = RecordProcessor<PostRecord, IndexedPost>

export const makePlugin = (db: Kysely<DatabaseSchema>): PluginType => {
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
