import stream from 'node:stream'
import { NoSuchKey, S3, S3ClientConfig } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { CID } from 'multiformats/cid'
import { SECOND, aggregateErrors, chunkArray } from '@atproto/common-web'
import { randomStr } from '@atproto/crypto'
import { BlobNotFoundError, BlobStore } from '@atproto/repo'

export type S3Config = {
  bucket: string
  /**
   * The maximum time any request to S3 (including individual blob chunks
   * uploads) can take, in milliseconds.
   */
  requestTimeoutMs?: number
  /**
   * The maximum total time a blob upload can take, in milliseconds.
   */
  uploadTimeoutMs?: number
} & Omit<S3ClientConfig, 'apiVersion' | 'requestHandler'>

export class S3BlobStore implements BlobStore {
  private client: S3
  private bucket: string
  private uploadTimeoutMs: number

  constructor(
    public did: string,
    cfg: S3Config,
  ) {
    const {
      bucket,
      uploadTimeoutMs = 10 * SECOND,
      requestTimeoutMs = uploadTimeoutMs,
      ...rest
    } = cfg
    this.bucket = bucket
    this.uploadTimeoutMs = uploadTimeoutMs
    this.client = new S3({
      ...rest,
      apiVersion: '2006-03-01',
      // Ensures that all requests timeout under "requestTimeoutMs".
      //
      // @NOTE This will also apply to the upload of each individual chunk
      // when using Upload from @aws-sdk/lib-storage.
      requestHandler: { requestTimeout: requestTimeoutMs },
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
    // @NOTE we use Upload rather than client.putObject because stream length is
    // not known in advance. See also aws/aws-sdk-js-v3#2348.
    //
    // See also https://github.com/aws/aws-sdk-js-v3/issues/6426, wherein Upload
    // may hang the s3 connection under certain circumstances. We don't have a
    // good way to avoid this, so we use timeouts defensively on all s3
    // requests.

    const abortSignal = AbortSignal.timeout(this.uploadTimeoutMs)
    const abortController = new AbortController()
    abortSignal.addEventListener('abort', () => abortController.abort())

    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Body: bytes,
        Key: path,
      },
      // @ts-ignore native implementation fine in node >=15
      abortController,
    })

    try {
      await upload.done()
    } catch (err) {
      // Translate aws-sdk's abort error to something more specific
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Blob upload timed out', { cause: err })
      }

      throw err
    }
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
      // If the optimistic move failed because the temp file was not found,
      // check if the permanent file already exists. If it does, we can assume
      // that another process made the file permanent concurrently, and we can
      // no-op.
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
    if (errors.length) throw aggregateErrors(errors)
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
