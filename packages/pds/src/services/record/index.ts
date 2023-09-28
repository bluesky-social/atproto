import { CID } from 'multiformats/cid'
import { AtUri, ensureValidAtUri } from '@atproto/syntax'
import * as ident from '@atproto/syntax'
import { cborToLexRecord, WriteOpAction } from '@atproto/repo'
import { dbLogger as log } from '../../logger'
import Database from '../../db'
import { notSoftDeletedClause } from '../../db/util'
import { Backlink } from '../../db/tables/backlink'
import { ids } from '../../lexicon/lexicons'

export class RecordService {
  constructor(public db: Database) {}

  static creator() {
    return (db: Database) => new RecordService(db)
  }

  async indexRecord(
    uri: AtUri,
    cid: CID,
    obj: unknown,
    action: WriteOpAction.Create | WriteOpAction.Update = WriteOpAction.Create,
    repoRev?: string,
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
      repoRev: repoRev ?? null,
      indexedAt: timestamp || new Date().toISOString(),
    }
    if (!record.did.startsWith('did:')) {
      throw new Error('Expected indexed URI to contain DID')
    } else if (record.collection.length < 1) {
      throw new Error('Expected indexed URI to contain a collection')
    } else if (record.rkey.length < 1) {
      throw new Error('Expected indexed URI to contain a record key')
    }

    // Track current version of record
    await this.db.db
      .insertInto('record')
      .values(record)
      .onConflict((oc) =>
        oc.column('uri').doUpdateSet({
          cid: record.cid,
          repoRev: repoRev ?? null,
          indexedAt: record.indexedAt,
        }),
      )
      .execute()

    // Maintain backlinks
    const backlinks = getBacklinks(uri, obj)
    if (action === WriteOpAction.Update) {
      // On update just recreate backlinks from scratch for the record, so we can clear out
      // the old ones. E.g. for weird cases like updating a follow to be for a different did.
      await this.removeBacklinksByUri(uri)
    }
    await this.addBacklinks(backlinks)

    log.info({ uri }, 'indexed record')
  }

  async deleteRecord(uri: AtUri) {
    this.db.assertTransaction()
    log.debug({ uri }, 'deleting indexed record')
    const deleteQuery = this.db.db
      .deleteFrom('record')
      .where('uri', '=', uri.toString())
    const backlinkQuery = this.db.db
      .deleteFrom('backlink')
      .where('uri', '=', uri.toString())
    await Promise.all([deleteQuery.execute(), backlinkQuery.execute()])

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

  async listRecordsForCollection(opts: {
    did: string
    collection: string
    limit: number
    reverse: boolean
    cursor?: string
    rkeyStart?: string
    rkeyEnd?: string
    includeSoftDeleted?: boolean
  }): Promise<{ uri: string; cid: string; value: object }[]> {
    const {
      did,
      collection,
      limit,
      reverse,
      cursor,
      rkeyStart,
      rkeyEnd,
      includeSoftDeleted = false,
    } = opts

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

    // prioritize cursor but fall back to soon-to-be-depcreated rkey start/end
    if (cursor !== undefined) {
      if (reverse) {
        builder = builder.where('record.rkey', '>', cursor)
      } else {
        builder = builder.where('record.rkey', '<', cursor)
      }
    } else {
      if (rkeyStart !== undefined) {
        builder = builder.where('record.rkey', '>', rkeyStart)
      }
      if (rkeyEnd !== undefined) {
        builder = builder.where('record.rkey', '<', rkeyEnd)
      }
    }
    const res = await builder.execute()
    return res.map((row) => {
      return {
        uri: row.uri,
        cid: row.cid,
        value: cborToLexRecord(row.content),
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
      value: cborToLexRecord(record.content),
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

  async deleteForActor(did: string) {
    // Not done in transaction because it would be too long, prone to contention.
    // Also, this can safely be run multiple times if it fails.
    await this.db.db.deleteFrom('record').where('did', '=', did).execute()
    await this.db.db
      .deleteFrom('user_notification')
      .where('author', '=', did)
      .execute()
  }

  async removeBacklinksByUri(uri: AtUri) {
    await this.db.db
      .deleteFrom('backlink')
      .where('uri', '=', uri.toString())
      .execute()
  }

  async addBacklinks(backlinks: Backlink[]) {
    if (backlinks.length === 0) return
    await this.db.db
      .insertInto('backlink')
      .values(backlinks)
      .onConflict((oc) => oc.doNothing())
      .execute()
  }

  async getRecordBacklinks(opts: {
    did: string
    collection: string
    path: string
    linkTo: string
  }) {
    const { did, collection, path, linkTo } = opts
    return await this.db.db
      .selectFrom('record')
      .innerJoin('backlink', 'backlink.uri', 'record.uri')
      .where('backlink.path', '=', path)
      .if(linkTo.startsWith('at://'), (q) =>
        q.where('backlink.linkToUri', '=', linkTo),
      )
      .if(!linkTo.startsWith('at://'), (q) =>
        q.where('backlink.linkToDid', '=', linkTo),
      )
      .where('record.did', '=', did)
      .where('record.collection', '=', collection)
      .selectAll('record')
      .execute()
  }
}

// @NOTE in the future this can be replaced with a more generic routine that pulls backlinks based on lex docs.
// For now we just want to ensure we're tracking links from follows, blocks, likes, and reposts.

function getBacklinks(uri: AtUri, record: unknown): Backlink[] {
  if (
    record?.['$type'] === ids.AppBskyGraphFollow ||
    record?.['$type'] === ids.AppBskyGraphBlock
  ) {
    const subject = record['subject']
    if (typeof subject !== 'string') {
      return []
    }
    try {
      ident.ensureValidDid(subject)
    } catch {
      return []
    }
    return [
      {
        uri: uri.toString(),
        path: 'subject',
        linkToDid: subject,
        linkToUri: null,
      },
    ]
  }
  if (
    record?.['$type'] === ids.AppBskyFeedLike ||
    record?.['$type'] === ids.AppBskyFeedRepost
  ) {
    const subject = record['subject']
    if (typeof subject['uri'] !== 'string') {
      return []
    }
    try {
      ensureValidAtUri(subject['uri'])
    } catch {
      return []
    }
    return [
      {
        uri: uri.toString(),
        path: 'subject.uri',
        linkToUri: subject.uri,
        linkToDid: null,
      },
    ]
  }
  return []
}
