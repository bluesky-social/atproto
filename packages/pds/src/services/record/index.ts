import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/uri'
import * as common from '@atproto/common'
import { WriteOpAction } from '@atproto/repo'
import { dbLogger as log } from '../../logger'
import Database from '../../db'
import { notSoftDeletedClause } from '../../db/util'
import { MessageQueue } from '../../event-stream/types'
import {
  indexRecord,
  deleteRecord,
  deleteRepo,
} from '../../event-stream/messages'

export class RecordService {
  constructor(public db: Database, public messageDispatcher: MessageQueue) {}

  static creator(messageDispatcher: MessageQueue) {
    return (db: Database) => new RecordService(db, messageDispatcher)
  }

  async indexRecord(
    uri: AtUri,
    cid: CID,
    obj: unknown,
    action: WriteOpAction.Create | WriteOpAction.Update = WriteOpAction.Create,
    timestamp?: string,
  ) {
    this.db.assertTransaction()
    log.debug({ uri }, 'indexing record')
    const record = {
      uri: uri.toString(),
      cid: cid.toString(),
      did: uri.host,
      collection: uri.collection,
      rkey: uri.rkey,
      indexedAt: timestamp || new Date().toISOString(),
    }
    if (!record.did.startsWith('did:')) {
      throw new Error('Expected indexed URI to contain DID')
    } else if (record.collection.length < 1) {
      throw new Error('Expected indexed URI to contain a collection')
    } else if (record.rkey.length < 1) {
      throw new Error('Expected indexed URI to contain a record key')
    }
    await this.db.db
      .insertInto('record')
      .values(record)
      .onConflict((oc) =>
        oc
          .column('uri')
          .doUpdateSet({ cid: record.cid, indexedAt: record.indexedAt }),
      )
      .execute()

    await this.messageDispatcher.send(
      this.db,
      indexRecord(uri, cid, obj, action, record.indexedAt),
    )

    log.info({ uri }, 'indexed record')
  }

  async deleteRecord(uri: AtUri, cascading = false) {
    this.db.assertTransaction()
    log.debug({ uri }, 'deleting indexed record')
    const deleteQuery = this.db.db
      .deleteFrom('record')
      .where('uri', '=', uri.toString())
      .execute()

    await Promise.all([
      this.messageDispatcher.send(this.db, deleteRecord(uri, cascading)),
      deleteQuery,
    ])

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
      .innerJoin('ipld_block', (join) =>
        join
          .onRef('ipld_block.cid', '=', 'record.cid')
          .on('ipld_block.creator', '=', did),
      )
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
        value: common.cborDecode(row.content),
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
      .innerJoin('ipld_block', (join) =>
        join
          .onRef('ipld_block.cid', '=', 'record.cid')
          .on('ipld_block.creator', '=', uri.host),
      )
      .where('record.uri', '=', uri.toString())
      .selectAll()
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
      value: common.cborDecode(record.content),
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

  async deleteForUser(did: string) {
    this.db.assertTransaction()
    await this.messageDispatcher.send(this.db, deleteRepo(did))
    await Promise.all([
      this.db.db.deleteFrom('record').where('did', '=', did).execute(),
      this.db.db
        .deleteFrom('user_notification')
        .where('author', '=', did)
        .execute(),
    ])
  }
}
