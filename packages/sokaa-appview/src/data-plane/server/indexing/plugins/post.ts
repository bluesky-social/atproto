import { Selectable } from 'kysely'
import { CID } from 'multiformats/cid'
import { AppSokaaFeedPost } from '@atproto/api'
import { AtUri } from '@atproto/syntax'
import { Database } from '../../db'
import { DatabaseSchema, DatabaseSchemaType } from '../../db/database-schema'
import { countAll, excluded } from '../../db/util'
import { ids } from '../collections'
import { RecordProcessor } from '../processor'
import { normalizeCreatedAt, stripNullBytes } from '../sanitizers'

type IndexedPost = Selectable<DatabaseSchemaType['post']>

const parseMedia = (media: AppSokaaFeedPost.Record['media']) => {
  const type = media.$type ?? ''
  if (type === ids.AppSokaaEmbedVideo) {
    return { mediaType: 'video', mediaJson: media }
  }
  if (type === ids.AppSokaaEmbedImages) {
    return { mediaType: 'images', mediaJson: media }
  }
  return { mediaType: type || 'unknown', mediaJson: media }
}

const insertFn = async (
  db: DatabaseSchema,
  uri: AtUri,
  cid: CID,
  obj: AppSokaaFeedPost.Record,
  timestamp: string,
): Promise<IndexedPost | null> => {
  const { mediaType, mediaJson } = parseMedia(obj.media)
  const inserted = await db
    .insertInto('post')
    .values({
      uri: uri.toString(),
      cid: cid.toString(),
      creator: uri.host,
      caption: stripNullBytes(obj.caption),
      mediaType,
      mediaJson,
      createdAt: normalizeCreatedAt(obj.createdAt),
      indexedAt: timestamp,
    })
    .onConflict((oc) => oc.doNothing())
    .returningAll()
    .executeTakeFirst()
  return inserted || null
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
  return deleted || null
}

const updateAggregates = async (db: DatabaseSchema, post: IndexedPost) => {
  await db
    .insertInto('actor')
    .values({
      did: post.creator,
      indexedAt: post.indexedAt,
      postsCount: db
        .selectFrom('post')
        .where('creator', '=', post.creator)
        .select(countAll.as('count')),
    })
    .onConflict((oc) =>
      oc.column('did').doUpdateSet({
        postsCount: excluded(db, 'postsCount'),
      }),
    )
    .execute()
}

export type PluginType = RecordProcessor<AppSokaaFeedPost.Record, IndexedPost>

export const makePlugin = (db: Database): PluginType => {
  return new RecordProcessor(db, {
    lexId: ids.AppSokaaFeedPost,
    validate: (obj) => {
      AppSokaaFeedPost.validateRecord(obj)
    },
    insertFn,
    deleteFn,
    updateAggregates,
  })
}
