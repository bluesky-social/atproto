import stream from 'stream'
import { CID } from 'multiformats/cid'
import { BlobNotFoundError, BlobStore } from '@atproto/repo'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { ActorDb } from '../db'
import { countAll, countDistinct, notSoftDeletedClause } from '../../db/util'
import { StatusAttr } from '../../lexicon/types/com/atproto/admin/defs'

export class BlobReader {
  constructor(public db: ActorDb, public blobstore: BlobStore) {}

  async getBlob(
    cid: CID,
  ): Promise<{ size: number; mimeType?: string; stream: stream.Readable }> {
    const { ref } = this.db.db.dynamic
    const found = await this.db.db
      .selectFrom('blob')
      .selectAll()
      .where('blob.cid', '=', cid.toString())
      .where(notSoftDeletedClause(ref('blob')))
      .executeTakeFirst()
    if (!found) {
      throw new InvalidRequestError('Blob not found')
    }
    let blobStream
    try {
      blobStream = await this.blobstore.getStream(cid)
    } catch (err) {
      if (err instanceof BlobNotFoundError) {
        throw new InvalidRequestError('Blob not found')
      }
      throw err
    }
    return {
      size: found.size,
      mimeType: found.mimeType,
      stream: blobStream,
    }
  }

  async listBlobs(opts: {
    since?: string
    cursor?: string
    limit: number
  }): Promise<string[]> {
    const { since, cursor, limit } = opts
    let builder = this.db.db
      .selectFrom('record_blob')
      .select('blobCid')
      .orderBy('blobCid', 'asc')
      .groupBy('blobCid')
      .limit(limit)
    if (since) {
      builder = builder
        .innerJoin('record', 'record.uri', 'record_blob.recordUri')
        .where('record.repoRev', '>', since)
    }
    if (cursor) {
      builder = builder.where('blobCid', '>', cursor)
    }
    const res = await builder.execute()
    return res.map((row) => row.blobCid)
  }

  async getBlobTakedownStatus(cid: CID): Promise<StatusAttr | null> {
    const res = await this.db.db
      .selectFrom('blob')
      .select('takedownRef')
      .where('cid', '=', cid.toString())
      .executeTakeFirst()
    if (!res) return null
    return res.takedownRef
      ? { applied: true, ref: res.takedownRef }
      : { applied: false }
  }

  async getRecordsForBlob(cid: CID): Promise<string[]> {
    const res = await this.db.db
      .selectFrom('record_blob')
      .where('blobCid', '=', cid.toString())
      .selectAll()
      .execute()
    return res.map((row) => row.recordUri)
  }

  async blobCount(): Promise<number> {
    const res = await this.db.db
      .selectFrom('blob')
      .select(countAll.as('count'))
      .executeTakeFirst()
    return res?.count ?? 0
  }

  async recordBlobCount(): Promise<number> {
    const { ref } = this.db.db.dynamic
    const res = await this.db.db
      .selectFrom('record_blob')
      .select(countDistinct(ref('blobCid')).as('count'))
      .executeTakeFirst()
    return res?.count ?? 0
  }

  async listMissingBlobs(opts: {
    cursor?: string
    limit: number
  }): Promise<{ cid: string; recordUri: string }[]> {
    const { cursor, limit } = opts
    let builder = this.db.db
      .selectFrom('record_blob')
      .whereNotExists((qb) =>
        qb
          .selectFrom('blob')
          .selectAll()
          .whereRef('blob.cid', '=', 'record_blob.blobCid'),
      )
      .selectAll()
      .orderBy('blobCid', 'asc')
      .groupBy('blobCid')
      .limit(limit)
    if (cursor) {
      builder = builder.where('blobCid', '>', cursor)
    }
    const res = await builder.execute()
    return res.map((row) => ({
      cid: row.blobCid,
      recordUri: row.recordUri,
    }))
  }
}
