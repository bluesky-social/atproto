import stream from 'node:stream'
import { Cid, parseCid } from '@atproto/lex-data'
import { BlobNotFoundError, BlobStore } from '@atproto/repo'
import { AtUriString } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { countAll, countDistinct, notSoftDeletedClause } from '../../db/util'
import { com } from '../../lexicons/index.js'
import { ActorDb } from '../db'

export class BlobReader {
  constructor(
    public db: ActorDb,
    public blobstore: BlobStore,
  ) {}

  async getBlobMetadata(
    cid: Cid,
  ): Promise<{ size: number; mimeType?: `${string}/${string}` }> {
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
    return {
      size: found.size,
      mimeType: found.mimeType as `${string}/${string}` | undefined,
    }
  }

  async getBlob(cid: Cid): Promise<{
    size: number
    mimeType?: `${string}/${string}`
    stream: stream.Readable
  }> {
    const metadata = await this.getBlobMetadata(cid)
    const stream = await this.blobstore.getStream(cid).catch((err) => {
      if (err instanceof BlobNotFoundError) {
        throw new InvalidRequestError('Blob not found')
      }
      throw err
    })

    return { ...metadata, stream }
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

  async getBlobTakedownStatus(
    cid: Cid,
  ): Promise<com.atproto.admin.defs.StatusAttr | null> {
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

  async hasRecordsForBlob(cid: Cid): Promise<boolean> {
    const res = await this.db.db
      .selectFrom('record_blob')
      .where('blobCid', '=', cid.toString())
      .select('blobCid')
      .limit(1)
      .executeTakeFirst()
    return res != null
  }

  async getBlobsForRecord(recordUri: string): Promise<string[]> {
    const res = await this.db.db
      .selectFrom('blob')
      .innerJoin('record_blob', 'record_blob.blobCid', 'blob.cid')
      .where('recordUri', '=', recordUri)
      .select('blob.cid')
      .execute()
    return res.map((row) => row.cid)
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
  }): Promise<{ cid: string; recordUri: AtUriString }[]> {
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
      recordUri: row.recordUri as AtUriString,
    }))
  }

  async getBlobCids() {
    const blobRows = await this.db.db.selectFrom('blob').select('cid').execute()
    return blobRows.map((row) => parseCid(row.cid))
  }
}
