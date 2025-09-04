import stream from 'node:stream'
import {
  NoSuchKey,
  PutObjectCommand,
  S3,
  S3ClientConfig,
} from '@aws-sdk/client-s3'
import { CID } from 'multiformats/cid'
import { SECOND, chunkArray } from '@atproto/common-web'
import { randomStr } from '@atproto/crypto'
import { BlobNotFoundError, BlobStore } from '@atproto/repo'

export type S3Config = {
  bucket: string
  requestTimeoutMs?: number
  uploadTimeoutMs?: number
} & Omit<S3ClientConfig, 'apiVersion' | 'requestHandler'>

// @NOTE we use Upload rather than client.putObject because stream
// length is not known in advance. See also aws/aws-sdk-js-v3#2348.

export class S3BlobStore implements BlobStore {
  private client: S3
  private bucket: string
  private uploadTimeoutMs: number

  constructor(
    public did: string,
    cfg: S3Config,
  ) {
    const { bucket, requestTimeoutMs, uploadTimeoutMs, ...rest } = cfg
    this.bucket = bucket
    this.uploadTimeoutMs = uploadTimeoutMs ?? 10 * SECOND
    this.client = new S3({
      ...rest,
      apiVersion: '2006-03-01',
      // Ensures that all requests timeout under "requestTimeoutMs"
      requestHandler: { requestTimeout: requestTimeoutMs ?? 5 * SECOND },
    })
  }

  static creator(cfg: S3Config) {
    return (did: string) => {
      return new S3BlobStore(did, cfg)
    }
  }

  private genKey() {
    return randomStr(32, 'base32')
  }

  private getTmpPath(key: string): string {
    return `tmp/${this.did}/${key}`
  }

  private getStoredPath(cid: CID): string {
    return `blocks/${this.did}/${cid.toString()}`
  }

  private getQuarantinedPath(cid: CID): string {
    return `quarantine/${this.did}/${cid.toString()}`
  }

  private async uploadBytes(path: string, bytes: Uint8Array | stream.Readable) {
    // There is an issue with @aws-sdk/lib-storage's "Upload" that causes it to
    // hang indefinitely. It seems that "PutObjectCommand" is not affected.

    // In particular, `Upload`'s abortController **should not** be used. Indeed,
    // in its current implementation, it uses a "Promise.race" under the hood,
    // which will not cause the pending request to be actually destroyed, and
    // can lead any further request (made through the same HTTP Agent) to hang
    // indefinitely. Note that older version of AWS's SDK also presented this
    // issue for *every* request made through the client. So make sure to use
    // recent enough version (>= 3.879.0).

    // The main drawback of using "PutObjectCommand" vs "Upload" is that
    // "PutObjectCommand" does not support concurrent chunked uploads. This
    // should not be an issue in our case though as the chunk size is 5MB, which
    // is smaller than most blobs.

    // See: https://github.com/aws/aws-sdk-js-v3/issues/6426

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: path,
        Body: bytes,
      }),
      {
        // Allow for a longer timeout for uploads than for regular requests
        requestTimeout: this.uploadTimeoutMs,
      },
    )
  }

  async putTemp(bytes: Uint8Array | stream.Readable): Promise<string> {
    const key = this.genKey()
    await this.uploadBytes(this.getTmpPath(key), bytes)
    return key
  }

  async makePermanent(key: string, cid: CID): Promise<void> {
    try {
      // @NOTE we normally call this method when we know the file is temporary.
      // Because of this, we optimistically move the file, allowing to make
      // fewer network requests in the happy path.
      await this.move({
        from: this.getTmpPath(key),
        to: this.getStoredPath(cid),
      })
    } catch (err) {
      if (err instanceof BlobNotFoundError) {
        // Blob was not found from temp storage...
        const alreadyHas = await this.hasStored(cid)
        // already saved, so we no-op
        if (alreadyHas) return
      }

      throw err
    }
  }

  async putPermanent(
    cid: CID,
    bytes: Uint8Array | stream.Readable,
  ): Promise<void> {
    await this.uploadBytes(this.getStoredPath(cid), bytes)
  }

  async quarantine(cid: CID): Promise<void> {
    await this.move({
      from: this.getStoredPath(cid),
      to: this.getQuarantinedPath(cid),
    })
  }

  async unquarantine(cid: CID): Promise<void> {
    await this.move({
      from: this.getQuarantinedPath(cid),
      to: this.getStoredPath(cid),
    })
  }

  private async getObject(cid: CID) {
    const res = await this.client.getObject({
      Bucket: this.bucket,
      Key: this.getStoredPath(cid),
    })
    if (res.Body) {
      return res.Body
    } else {
      throw new BlobNotFoundError()
    }
  }

  async getBytes(cid: CID): Promise<Uint8Array> {
    const res = await this.getObject(cid)
    return res.transformToByteArray()
  }

  async getStream(cid: CID): Promise<stream.Readable> {
    const res = await this.getObject(cid)
    return res as stream.Readable
  }

  async delete(cid: CID): Promise<void> {
    await this.deleteKey(this.getStoredPath(cid))
  }

  async deleteMany(cids: CID[]): Promise<void> {
    const errors: unknown[] = []
    for (const chunk of chunkArray(cids, 500)) {
      try {
        const keys = chunk.map((cid) => this.getStoredPath(cid))
        await this.deleteManyKeys(keys)
      } catch (err) {
        errors.push(err)
      }
    }
    if (errors.length === 1) {
      throw errors[0]
    }
    if (errors.length > 1) {
      throw new AggregateError(errors, 'Multiple errors while deleting objects')
    }
  }

  async hasStored(cid: CID): Promise<boolean> {
    return this.hasKey(this.getStoredPath(cid))
  }

  async hasTemp(key: string): Promise<boolean> {
    return this.hasKey(this.getTmpPath(key))
  }

  private async hasKey(key: string) {
    try {
      const res = await this.client.headObject({
        Bucket: this.bucket,
        Key: key,
      })
      return res.$metadata.httpStatusCode === 200
    } catch (err) {
      return false
    }
  }

  private async deleteKey(key: string) {
    await this.client.deleteObject({
      Bucket: this.bucket,
      Key: key,
    })
  }

  private async deleteManyKeys(keys: string[]) {
    await this.client.deleteObjects({
      Bucket: this.bucket,
      Delete: {
        Objects: keys.map((k) => ({ Key: k })),
      },
    })
  }

  private async move(keys: { from: string; to: string }) {
    try {
      await this.client.copyObject({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${keys.from}`,
        Key: keys.to,
      })
    } catch (cause) {
      if (cause instanceof NoSuchKey) {
        // Already deleted, possibly by a concurrently running process
        throw new BlobNotFoundError(undefined, { cause })
      }

      throw cause
    }

    try {
      await this.client.deleteObject({
        Bucket: this.bucket,
        Key: keys.from,
      })
    } catch (err) {
      if (err instanceof NoSuchKey) {
        // Already deleted, possibly by a concurrently running process
        return
      }

      throw err
    }
  }
}

export default S3BlobStore
