import { CID } from 'multiformats/cid'
import { WriteOpAction } from '@atproto/repo'
import { AtUri } from '@atproto/uri'
import Database from '../../../db'
import * as Post from './plugins/post'
import * as Like from './plugins/like'
import * as Repost from './plugins/repost'
import * as Follow from './plugins/follow'
import * as Profile from './plugins/profile'
import { MessageQueue } from '../../../event-stream/types'

export class IndexingService {
  records: {
    post: Post.PluginType
    like: Like.PluginType
    repost: Repost.PluginType
    follow: Follow.PluginType
    profile: Profile.PluginType
  }

  constructor(public db: Database, public messageDispatcher: MessageQueue) {
    this.records = {
      post: Post.makePlugin(this.db.db),
      like: Like.makePlugin(this.db.db),
      repost: Repost.makePlugin(this.db.db),
      follow: Follow.makePlugin(this.db.db),
      profile: Profile.makePlugin(this.db.db),
    }
  }

  static creator(messageDispatcher: MessageQueue) {
    return (db: Database) => new IndexingService(db, messageDispatcher)
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
    await Promise.all([
      this.db.db.deleteFrom('follow').where('creator', '=', did).execute(),
      this.db.db.deleteFrom('post').where('creator', '=', did).execute(),
      this.db.db.deleteFrom('profile').where('creator', '=', did).execute(),
      this.db.db.deleteFrom('repost').where('creator', '=', did).execute(),
      this.db.db.deleteFrom('like').where('creator', '=', did).execute(),
    ])
  }
}
