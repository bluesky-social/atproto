import { CID } from 'multiformats/cid'
import { WriteOpAction } from '@atproto/repo'
import { AtUri } from '@atproto/uri'
import Database from '../../db'
import * as Post from './plugins/post'
import * as Vote from './plugins/vote'
import * as Repost from './plugins/repost'
import * as Follow from './plugins/follow'
import * as Profile from './plugins/profile'
import RecordProcessor from './processor'

export class IndexingService {
  records: {
    post: Post.PluginType
    vote: Vote.PluginType
    repost: Repost.PluginType
    follow: Follow.PluginType
    profile: Profile.PluginType
  }

  constructor(public db: Database) {
    this.records = {
      post: Post.makePlugin(this.db.db),
      vote: Vote.makePlugin(this.db.db),
      repost: Repost.makePlugin(this.db.db),
      follow: Follow.makePlugin(this.db.db),
      profile: Profile.makePlugin(this.db.db),
    }
  }

  static creator() {
    return (db: Database) => new IndexingService(db)
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
    if (!indexer) return
    // @TODO(bsky) direct notifs
    const notifs =
      action === WriteOpAction.Create
        ? await indexer.insertRecord(uri, cid, obj, timestamp)
        : await indexer.updateRecord(uri, cid, obj, timestamp)
    return notifs
  }

  async deleteRecord(uri: AtUri, cascading = false) {
    this.db.assertTransaction()
    const indexer = this.findIndexerForCollection(uri.collection)
    if (!indexer) return
    // @TODO(bsky) direct notifs
    const notifs = await indexer.deleteRecord(uri, cascading)
    return notifs
  }

  findIndexerForCollection(collection: string) {
    const indexers = Object.values(
      this.records as Record<string, RecordProcessor<unknown, unknown>>,
    )
    return indexers.find((indexer) => indexer.collection === collection)
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
        .deleteFrom('post_entity')
        .where('post_entity.postUri', 'in', postByUser)
        .execute(),
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
      this.db.db.deleteFrom('vote').where('creator', '=', did).execute(),
    ])
  }
}
