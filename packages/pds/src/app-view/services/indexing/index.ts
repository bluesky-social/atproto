import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/uri'
import Database from '../../../db'
import * as Declaration from './plugins/declaration'
import * as Post from './plugins/post'
import * as Vote from './plugins/vote'
import * as Repost from './plugins/repost'
import * as Follow from './plugins/follow'
import * as Assertion from './plugins/assertion'
import * as Confirmation from './plugins/confirmation'
import * as Profile from './plugins/profile'
import { MessageQueue } from '../../../event-stream/types'

export class IndexingService {
  records: {
    declaration: Declaration.PluginType
    post: Post.PluginType
    vote: Vote.PluginType
    repost: Repost.PluginType
    follow: Follow.PluginType
    profile: Profile.PluginType
    assertion: Assertion.PluginType
    confirmation: Confirmation.PluginType
  }

  constructor(
    public db: Database,
    public messageQueue: MessageQueue,
    public messageDispatcher: MessageQueue,
  ) {
    this.records = {
      declaration: Declaration.makePlugin(this.db.db),
      post: Post.makePlugin(this.db.db),
      vote: Vote.makePlugin(this.db.db),
      repost: Repost.makePlugin(this.db.db),
      follow: Follow.makePlugin(this.db.db),
      assertion: Assertion.makePlugin(this.db.db),
      confirmation: Confirmation.makePlugin(this.db.db),
      profile: Profile.makePlugin(this.db.db),
    }
  }

  static creator(messageQueue: MessageQueue, messageDispatcher: MessageQueue) {
    return (db: Database) =>
      new IndexingService(db, messageQueue, messageDispatcher)
  }

  async indexRecord(uri: AtUri, cid: CID, obj: unknown, timestamp: string) {
    this.db.assertTransaction()
    const table = this.findTableForCollection(uri.collection)
    const events = await table.insertRecord(uri, cid, obj, timestamp)
    await this.messageQueue.send(this.db, events)
  }

  async deleteRecord(uri: AtUri, cascading = false) {
    this.db.assertTransaction()
    const table = this.findTableForCollection(uri.collection)
    const events = await table.deleteRecord(uri, cascading)
    await this.messageQueue.send(this.db, events)
  }

  findTableForCollection(collection: string) {
    const found = Object.values(this.records).find(
      (plugin) => plugin.collection === collection,
    )
    if (!found) {
      throw new Error('Could not find table for collection')
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
          // @TODO remove dependency on record table from app view
          qb
            .selectFrom('record')
            .where('record.did', '=', did)
            .select('record.uri as uri'),
        )
        .execute(),
    ])
    await Promise.all([
      this.db.db.deleteFrom('record').where('did', '=', did).execute(),
      this.db.db.deleteFrom('assertion').where('creator', '=', did).execute(),
      this.db.db.deleteFrom('follow').where('creator', '=', did).execute(),
      this.db.db.deleteFrom('post').where('creator', '=', did).execute(),
      this.db.db.deleteFrom('profile').where('creator', '=', did).execute(),
      this.db.db.deleteFrom('repost').where('creator', '=', did).execute(),
      this.db.db.deleteFrom('vote').where('creator', '=', did).execute(),
      this.db.db
        .updateTable('assertion')
        .set({
          confirmUri: null,
          confirmCid: null,
          confirmCreated: null,
          confirmIndexed: null,
        })
        .where('subjectDid', '=', did)
        .execute(),
    ])
  }
}
