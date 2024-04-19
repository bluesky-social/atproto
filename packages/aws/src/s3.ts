import * as aws from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { BlobStore, BlobNotFoundError } from '@atproto/repo'
import { randomStr } from '@atproto/crypto'
import { CID } from 'multiformats/cid'
import stream from 'stream'

export type S3Config = { bucket: string; uploadTimeoutMs?: number } & Omit<
  aws.S3ClientConfig,
  'apiVersion'
>

// @NOTE we use Upload rather than client.putObject because stream
// length is not known in advance. See also aws/aws-sdk-js-v3#2348.

export class S3BlobStore implements BlobStore {
  private client: aws.S3
  private bucket: string
  private uploadTimeoutMs: number

  constructor(
    public did: string,
    cfg: S3Config,
  ) {
    const { bucket, uploadTimeoutMs, ...rest } = cfg
    this.bucket = bucket
    this.uploadTimeoutMs = uploadTimeoutMs ?? 10000
    this.client = new aws.S3({
      ...rest,
      apiVersion: '2006-03-01',
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

  async putTemp(bytes: Uint8Array | stream.Readable): Promise<string> {
    const key = this.genKey()
    // @NOTE abort results in error from aws-sdk "Upload aborted." with name "AbortError"
    const abortController = new AbortController()
    const timeout = setTimeout(
      () => abortController.abort(),
      this.uploadTimeoutMs,
    )
    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Body: bytes,
        Key: this.getTmpPath(key),
      },
      // @ts-ignore native implementation fine in node >=15
      abortController,
    })
    try {
      await upload.done()
    } finally {
      clearTimeout(timeout)
    }
    return key
  }

  async makePermanent(key: string, cid: CID): Promise<void> {
    const alreadyHas = await this.hasStored(cid)
    if (!alreadyHas) {
      await this.move({
        from: this.getTmpPath(key),
        to: this.getStoredPath(cid),
      })
    } else {
      // already saved, so we no-op & just delete the temp
      await this.deleteKey(this.getTmpPath(key))
    }
  }

  async putPermanent(
    cid: CID,
    bytes: Uint8Array | stream.Readable,
  ): Promise<void> {
    // @NOTE abort results in error from aws-sdk "Upload aborted." with name "AbortError"
    const abortController = new AbortController()
    const timeout = setTimeout(
      () => abortController.abort(),
      this.uploadTimeoutMs,
    )
    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Body: bytes,
        Key: this.getStoredPath(cid),
      },
      // @ts-ignore native implementation fine in node >=15
      abortController,
    })
    try {
      await upload.done()
    } finally {
      clearTimeout(timeout)
    }
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
    const keys = cids.map((cid) => this.getStoredPath(cid))
    await this.deleteManyKeys(keys)
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
      await this.client.deleteObject({
        Bucket: this.bucket,
        Key: keys.from,
      })
    } catch (err) {
      handleErr(err)
    }
  }
}

const handleErr = (err: unknown) => {
  if (err?.['Code'] === 'NoSuchKey') {
    throw new BlobNotFoundError()
  } else {
    throw err
  }
}

export default S3BlobStore
