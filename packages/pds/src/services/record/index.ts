import { CID } from 'multiformats/cid'
import { ValidationError } from '@atproto/lexicon'
import { AtUri } from '@atproto/uri'
import * as common from '@atproto/common'
import { dbLogger as log } from '../../logger'
import Database from '../../db'
import * as Declaration from './plugins/declaration'
import * as Post from './plugins/post'
import * as Vote from './plugins/vote'
import * as Repost from './plugins/repost'
import * as Follow from './plugins/follow'
import * as Assertion from './plugins/assertion'
import * as Confirmation from './plugins/confirmation'
import * as Profile from './plugins/profile'
import { MessageQueue } from '../../event-stream/types'
import { notSoftDeletedClause } from '../../db/util'

export class RecordService {
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

  constructor(public db: Database, public messageQueue: MessageQueue) {
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

  static creator(messageQueue: MessageQueue) {
    return (db: Database) => new RecordService(db, messageQueue)
  }

  assertValidRecord(collection: string, obj: unknown): void {
    let table
    try {
      table = this.findTableForCollection(collection)
    } catch (e) {
      throw new ValidationError(`Schema not found`)
    }
    table.assertValidRecord(obj)
  }

  canIndexRecord(collection: string, obj: unknown): boolean {
    const table = this.findTableForCollection(collection)
    return table.matchesSchema(obj)
  }

  async indexRecord(uri: AtUri, cid: CID, obj: unknown, timestamp?: string) {
    this.db.assertTransaction()
    log.debug({ uri }, 'indexing record')
    const record = {
      uri: uri.toString(),
      cid: cid.toString(),
      did: uri.host,
      collection: uri.collection,
      rkey: uri.rkey,
    }
    if (!record.did.startsWith('did:')) {
      throw new Error('Expected indexed URI to contain DID')
    } else if (record.collection.length < 1) {
      throw new Error('Expected indexed URI to contain a collection')
    } else if (record.rkey.length < 1) {
      throw new Error('Expected indexed URI to contain a record key')
    }
    await this.db.db.insertInto('record').values(record).execute()

    const table = this.findTableForCollection(uri.collection)
    const events = await table.insertRecord(uri, cid, obj, timestamp)
    await this.messageQueue.send(this.db, events)

    log.info({ uri }, 'indexed record')
  }

  async deleteRecord(uri: AtUri, cascading = false) {
    this.db.assertTransaction()
    log.debug({ uri }, 'deleting indexed record')
    const table = this.findTableForCollection(uri.collection)
    const deleteQuery = this.db.db
      .deleteFrom('record')
      .where('uri', '=', uri.toString())
      .execute()

    const [events] = await Promise.all([
      table.deleteRecord(uri, cascading),
      deleteQuery,
    ])
    await this.messageQueue.send(this.db, events)

    log.info({ uri }, 'deleted indexed record')
  }

  async listCollectionsForDid(did: string): Promise<string[]> {
    const collections = await this.db.db
      .selectFrom('record')
      .select('collection')
      .where('did', '=', did)
      .groupBy('collection')
      .execute()

    return collections.map((row) => row.collection)
  }

  async listRecordsForCollection(
    did: string,
    collection: string,
    limit: number,
    reverse: boolean,
    before?: string,
    after?: string,
    includeSoftDeleted = false,
  ): Promise<{ uri: string; cid: string; value: object }[]> {
    const { ref } = this.db.db.dynamic
    let builder = this.db.db
      .selectFrom('record')
      .innerJoin('ipld_block', 'ipld_block.cid', 'record.cid')
      .where('record.did', '=', did)
      .where('record.collection', '=', collection)
      .if(!includeSoftDeleted, (qb) =>
        qb.where(notSoftDeletedClause(ref('record'))),
      )
      .orderBy('record.rkey', reverse ? 'asc' : 'desc')
      .limit(limit)
      .selectAll()

    if (before !== undefined) {
      builder = builder.where('record.rkey', '<', before)
    }
    if (after !== undefined) {
      builder = builder.where('record.rkey', '>', after)
    }
    const res = await builder.execute()
    return res.map((row) => {
      return {
        uri: row.uri,
        cid: row.cid,
        value: common.ipldBytesToRecord(row.content),
      }
    })
  }

  async getRecord(
    uri: AtUri,
    cid: string | null,
    includeSoftDeleted = false,
  ): Promise<{
    uri: string
    cid: string
    value: object
    indexedAt: string
    takedownId: number | null
  } | null> {
    const { ref } = this.db.db.dynamic
    let builder = this.db.db
      .selectFrom('record')
      .innerJoin('ipld_block', 'ipld_block.cid', 'record.cid')
      .selectAll()
      .where('record.uri', '=', uri.toString())
      .if(!includeSoftDeleted, (qb) =>
        qb.where(notSoftDeletedClause(ref('record'))),
      )
    if (cid) {
      builder = builder.where('record.cid', '=', cid)
    }
    const record = await builder.executeTakeFirst()
    if (!record) return null
    return {
      uri: record.uri,
      cid: record.cid,
      value: common.ipldBytesToRecord(record.content),
      indexedAt: record.indexedAt,
      takedownId: record.takedownId,
    }
  }

  async hasRecord(
    uri: AtUri,
    cid: string | null,
    includeSoftDeleted = false,
  ): Promise<boolean> {
    const { ref } = this.db.db.dynamic
    let builder = this.db.db
      .selectFrom('record')
      .select('uri')
      .where('record.uri', '=', uri.toString())
      .if(!includeSoftDeleted, (qb) =>
        qb.where(notSoftDeletedClause(ref('record'))),
      )
    if (cid) {
      builder = builder.where('record.cid', '=', cid)
    }
    const record = await builder.executeTakeFirst()
    return !!record
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
}
