import { Selectable } from 'kysely'
import { CID } from 'multiformats/cid'
import { AtUri, normalizeDatetimeAlways } from '@atproto/syntax'
import * as lex from '../../../../lexicon/lexicons'
import * as Repost from '../../../../lexicon/types/app/bsky/feed/repost'
import { BackgroundQueue } from '../../background'
import { Database } from '../../db'
import { DatabaseSchema, DatabaseSchemaType } from '../../db/database-schema'
import { countAll, excluded } from '../../db/util'
import { RecordProcessor } from '../processor'

const lexId = lex.ids.AppBskyFeedRepost
type IndexedRepost = Selectable<DatabaseSchemaType['repost']>

const insertFn = async (
  db: DatabaseSchema,
  uri: AtUri,
  cid: CID,
  obj: Repost.Record,
  timestamp: string,
): Promise<IndexedRepost | null> => {
  const repost = {
    uri: uri.toString(),
    cid: cid.toString(),
    creator: uri.host,
    subject: obj.subject.uri,
    subjectCid: obj.subject.cid,
    createdAt: normalizeDatetimeAlways(obj.createdAt),
    indexedAt: timestamp,
  }
  const [inserted] = await Promise.all([
    db
      .insertInto('repost')
      .values(repost)
      .onConflict((oc) => oc.doNothing())
      .returningAll()
      .executeTakeFirst(),
    db
      .insertInto('feed_item')
      .values({
        type: 'repost',
        uri: repost.uri,
        cid: repost.cid,
        postUri: repost.subject,
        originatorDid: repost.creator,
        sortAt:
          repost.indexedAt < repost.createdAt
            ? repost.indexedAt
            : repost.createdAt,
      })
      .onConflict((oc) => oc.doNothing())
      .executeTakeFirst(),
  ])

  return inserted || null
}

const findDuplicate = async (
  db: DatabaseSchema,
  uri: AtUri,
  obj: Repost.Record,
): Promise<AtUri | null> => {
  const found = await db
    .selectFrom('repost')
    .where('creator', '=', uri.host)
    .where('subject', '=', obj.subject.uri)
    .selectAll()
    .executeTakeFirst()
  return found ? new AtUri(found.uri) : null
}

const notifsForInsert = (obj: IndexedRepost) => {
  const subjectUri = new AtUri(obj.subject)
  // prevent self-notifications
  const isSelf = subjectUri.host === obj.creator
  return isSelf
    ? []
    : [
        {
          did: subjectUri.host,
          author: obj.creator,
          recordUri: obj.uri,
          recordCid: obj.cid,
          reason: 'repost' as const,
          reasonSubject: subjectUri.toString(),
          sortAt: obj.sortAt,
        },
      ]
}

const deleteFn = async (
  db: DatabaseSchema,
  uri: AtUri,
): Promise<IndexedRepost | null> => {
  const uriStr = uri.toString()
  const [deleted] = await Promise.all([
    db
      .deleteFrom('repost')
      .where('uri', '=', uriStr)
      .returningAll()
      .executeTakeFirst(),
    db.deleteFrom('feed_item').where('uri', '=', uriStr).executeTakeFirst(),
  ])
  return deleted || null
}

const notifsForDelete = (
  deleted: IndexedRepost,
  replacedBy: IndexedRepost | null,
) => {
  const toDelete = replacedBy ? [] : [deleted.uri]
  return { notifs: [], toDelete }
}

const updateAggregates = async (db: DatabaseSchema, repost: IndexedRepost) => {
  const repostCountQb = db
    .insertInto('post_agg')
    .values({
      uri: repost.subject,
      repostCount: db
        .selectFrom('repost')
        .where('repost.subject', '=', repost.subject)
        .select(countAll.as('count')),
    })
    .onConflict((oc) =>
      oc
        .column('uri')
        .doUpdateSet({ repostCount: excluded(db, 'repostCount') }),
    )
  await repostCountQb.execute()
}

export type PluginType = RecordProcessor<Repost.Record, IndexedRepost>

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
    updateAggregates,
  })
}

export default makePlugin
