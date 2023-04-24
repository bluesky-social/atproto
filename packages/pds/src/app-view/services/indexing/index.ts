import { CID } from 'multiformats/cid'
import { WriteOpAction } from '@atproto/repo'
import { AtUri } from '@atproto/uri'
import Database from '../../../db'
import DatabaseSchema from '../../../db/database-schema'
import { excluded } from '../../../db/util'
import * as Post from './plugins/post'
import * as Like from './plugins/like'
import * as Repost from './plugins/repost'
import * as Follow from './plugins/follow'
import * as Profile from './plugins/profile'
import { BackgroundQueue } from '../../../event-stream/background-queue'

export class IndexingService {
  records: {
    post: Post.PluginType
    like: Like.PluginType
    repost: Repost.PluginType
    follow: Follow.PluginType
    profile: Profile.PluginType
  }

  constructor(public db: Database, public backgroundQueue: BackgroundQueue) {
    this.records = {
      post: Post.makePlugin(this.db, backgroundQueue),
      like: Like.makePlugin(this.db, backgroundQueue),
      repost: Repost.makePlugin(this.db, backgroundQueue),
      follow: Follow.makePlugin(this.db, backgroundQueue),
      profile: Profile.makePlugin(this.db, backgroundQueue),
    }
  }

  static creator(backgroundQueue: BackgroundQueue) {
    return (db: Database) => new IndexingService(db, backgroundQueue)
  }

  async indexRecord(
    uri: AtUri,
    cid: CID,
    obj: unknown,
    action: WriteOpAction.Create | WriteOpAction.Update,
    timestamp: string,
  ) {
    this.db.assertTransaction()
    const indexer = this.findIndexerForCollection(uri.collection)
    if (action === WriteOpAction.Create) {
      await indexer.insertRecord(uri, cid, obj, timestamp)
    } else {
      await indexer.updateRecord(uri, cid, obj, timestamp)
    }
  }

  async deleteRecord(uri: AtUri, cascading = false) {
    this.db.assertTransaction()
    const indexer = this.findIndexerForCollection(uri.collection)
    await indexer.deleteRecord(uri, cascading)
  }

  findIndexerForCollection(collection: string) {
    const found = Object.values(this.records).find(
      (plugin) => plugin.collection === collection,
    )
    if (!found) {
      throw new Error('Could not find indexer for collection')
    }
    return found
  }

  async deleteForUser(did: string) {
    this.db.assertTransaction()

    const postByUser = (qb) =>
      qb
        .selectFrom('post')
        .where('post.creator', '=', did)
        .select('post.uri as uri')

    await Promise.all([
      this.db.db
        .deleteFrom('post_embed_image')
        .where('post_embed_image.postUri', 'in', postByUser)
        .execute(),
      this.db.db
        .deleteFrom('post_embed_external')
        .where('post_embed_external.postUri', 'in', postByUser)
        .execute(),
      this.db.db
        .deleteFrom('post_embed_record')
        .where('post_embed_record.postUri', 'in', postByUser)
        .execute(),
      this.db.db
        .deleteFrom('duplicate_record')
        .where('duplicate_record.duplicateOf', 'in', (qb) =>
          // @TODO remove dependency on record table from app view
          qb
            .selectFrom('record')
            .where('record.did', '=', did)
            .select('record.uri as uri'),
        )
        .execute(),
    ])
    await removeActorAggregates(this.db.db, did)
    await Promise.all([
      this.db.db.deleteFrom('follow').where('creator', '=', did).execute(),
      this.db.db.deleteFrom('post').where('creator', '=', did).execute(),
      this.db.db.deleteFrom('profile').where('creator', '=', did).execute(),
      this.db.db.deleteFrom('repost').where('creator', '=', did).execute(),
      this.db.db.deleteFrom('like').where('creator', '=', did).execute(),
    ])
  }
}

async function removeActorAggregates(db: DatabaseSchema, did: string) {
  const ownProfileAggQb = db.deleteFrom('profile_agg').where('did', '=', did)
  const ownPostAggsQb = db
    .deleteFrom('post_agg')
    .where(
      'uri',
      'in',
      db
        .selectFrom('post')
        .where('post.creator', '=', did)
        .select('post.uri as uri'),
    )
  const replyCountQb = db
    .insertInto('post_agg')
    .columns(['uri', 'replyCount'])
    .expression((exp) =>
      exp
        .selectFrom('post as target')
        .leftJoin('post', (join) =>
          join
            .onRef('post.replyParent', '=', 'target.replyParent')
            .on('post.creator', '!=', did),
        )
        .where('target.creator', '=', did)
        .where('target.replyParent', 'is not', null)
        .groupBy('target.replyParent')
        .select([
          'target.replyParent as uri',
          db.fn.count('post.uri').as('replyCount'),
        ]),
    )
    .onConflict((oc) =>
      oc.column('uri').doUpdateSet({ replyCount: excluded(db, 'replyCount') }),
    )
  const followersCountQb = db
    .insertInto('profile_agg')
    .columns(['did', 'followersCount'])
    .expression((exp) =>
      exp
        .selectFrom('follow as target')
        .leftJoin('follow', (join) =>
          join
            .onRef('follow.subjectDid', '=', 'target.subjectDid')
            .on('follow.creator', '!=', did),
        )
        .where('target.creator', '=', did)
        .groupBy('target.subjectDid')
        .select([
          'target.subjectDid as did',
          db.fn.count('follow.uri').as('followersCount'),
        ]),
    )
    .onConflict((oc) =>
      oc.column('did').doUpdateSet({
        followersCount: excluded(db, 'followersCount'),
      }),
    )
  const likeCountQb = db
    .insertInto('post_agg')
    .columns(['uri', 'likeCount'])
    .expression((exp) =>
      exp
        .selectFrom('like as target')
        .leftJoin('like', (join) =>
          join
            .onRef('like.subject', '=', 'target.subject')
            .on('like.creator', '!=', did),
        )
        .where('target.creator', '=', did)
        .groupBy('target.subject')
        .select([
          'target.subject as uri',
          db.fn.count('like.uri').as('likeCount'),
        ]),
    )
    .onConflict((oc) =>
      oc.column('uri').doUpdateSet({ likeCount: excluded(db, 'likeCount') }),
    )
  const repostCountQb = db
    .insertInto('post_agg')
    .columns(['uri', 'repostCount'])
    .expression((exp) =>
      exp
        .selectFrom('repost as target')
        .leftJoin('repost', (join) =>
          join
            .onRef('repost.subject', '=', 'target.subject')
            .on('repost.creator', '!=', did),
        )
        .where('target.creator', '=', did)
        .groupBy('target.subject')
        .select([
          'target.subject as uri',
          db.fn.count('repost.uri').as('repostCount'),
        ]),
    )
    .onConflict((oc) =>
      oc
        .column('uri')
        .doUpdateSet({ repostCount: excluded(db, 'repostCount') }),
    )
  await Promise.all([
    ownProfileAggQb.execute(),
    ownPostAggsQb.execute(),
    replyCountQb.execute(),
    followersCountQb.execute(),
    likeCountQb.execute(),
    repostCountQb.execute(),
  ])
}
