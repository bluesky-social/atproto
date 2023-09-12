import { CID } from 'multiformats/cid'
import { WriteOpAction } from '@atproto/repo'
import { AtUri } from '@atproto/syntax'
import { ids } from '../../../lexicon/lexicons'
import Database from '../../../db'
import { BackgroundQueue } from '../../../event-stream/background-queue'
import { NoopProcessor } from './processor'
import * as Post from './plugins/post'
import * as Like from './plugins/like'
import * as Repost from './plugins/repost'
import * as Follow from './plugins/follow'
import * as Block from './plugins/block'
import * as List from './plugins/list'
import * as ListItem from './plugins/list-item'
import * as Profile from './plugins/profile'
import * as FeedGenerator from './plugins/feed-generator'

export class IndexingService {
  records: {
    post: Post.PluginType
    like: Like.PluginType
    repost: Repost.PluginType
    follow: Follow.PluginType
    block: Block.PluginType
    list: List.PluginType
    listItem: ListItem.PluginType
    listBlock: NoopProcessor
    profile: Profile.PluginType
    feedGenerator: FeedGenerator.PluginType
  }

  constructor(public db: Database, public backgroundQueue: BackgroundQueue) {
    this.records = {
      post: Post.makePlugin(this.db, backgroundQueue),
      like: Like.makePlugin(this.db, backgroundQueue),
      repost: Repost.makePlugin(this.db, backgroundQueue),
      follow: Follow.makePlugin(this.db, backgroundQueue),
      block: Block.makePlugin(this.db, backgroundQueue),
      list: List.makePlugin(this.db, backgroundQueue),
      listItem: ListItem.makePlugin(this.db, backgroundQueue),
      listBlock: new NoopProcessor(
        ids.AppBskyGraphListblock,
        this.db,
        backgroundQueue,
      ),
      profile: Profile.makePlugin(this.db, backgroundQueue),
      feedGenerator: FeedGenerator.makePlugin(this.db, backgroundQueue),
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
    // Not done in transaction because it would be too long, prone to contention.
    // Also, this can safely be run multiple times if it fails.
    // Omitting updates to profile_agg and post_agg since it's expensive
    // and they'll organically update themselves over time.

    const postByUser = (qb) =>
      qb
        .selectFrom('post')
        .where('post.creator', '=', did)
        .select('post.uri as uri')

    await this.db.db
      .deleteFrom('post_embed_image')
      .where('post_embed_image.postUri', 'in', postByUser)
      .execute()
    await this.db.db
      .deleteFrom('post_embed_external')
      .where('post_embed_external.postUri', 'in', postByUser)
      .execute()
    await this.db.db
      .deleteFrom('post_embed_record')
      .where('post_embed_record.postUri', 'in', postByUser)
      .execute()
    await this.db.db
      .deleteFrom('duplicate_record')
      .where('duplicate_record.duplicateOf', 'in', (qb) =>
        // @TODO remove dependency on record table from app view
        qb
          .selectFrom('record')
          .where('record.did', '=', did)
          .select('record.uri as uri'),
      )
      .execute()
    await this.db.db
      .deleteFrom('actor_block')
      .where('creator', '=', did)
      .execute()
    await this.db.db.deleteFrom('list').where('creator', '=', did).execute()
    await this.db.db
      .deleteFrom('list_item')
      .where('creator', '=', did)
      .execute()
    await this.db.db.deleteFrom('follow').where('creator', '=', did).execute()
    await this.db.db.deleteFrom('post').where('creator', '=', did).execute()
    await this.db.db.deleteFrom('profile').where('creator', '=', did).execute()
    await this.db.db.deleteFrom('repost').where('creator', '=', did).execute()
    await this.db.db.deleteFrom('like').where('creator', '=', did).execute()
  }
}
