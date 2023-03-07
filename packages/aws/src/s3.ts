import * as aws from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { BlobStore, BlobNotFoundError } from '@atproto/repo'
import { randomStr } from '@atproto/crypto'
import { CID } from 'multiformats/cid'
import stream from 'stream'

export type S3Config = { bucket: string } & Omit<
  aws.S3ClientConfig,
  'apiVersion'
>

// @NOTE we use Upload rather than client.putObject because stream
// length is not known in advance. See also aws/aws-sdk-js-v3#2348.

export class S3BlobStore implements BlobStore {
  private client: aws.S3
  private bucket: string

  constructor(cfg: S3Config) {
    const { bucket, ...rest } = cfg
    this.bucket = bucket
    this.client = new aws.S3({
      ...rest,
      apiVersion: '2006-03-01',
    })
  }

  private genKey() {
    return randomStr(32, 'base32')
  }

  private getTmpPath(key: string): string {
    return `tmp/${key}`
  }

  private getStoredPath(cid: CID): string {
    return `blocks/${cid.toString()}`
  }

  private getQuarantinedPath(cid: CID): string {
    return `quarantine/${cid.toString()}`
  }

  async putTemp(bytes: Uint8Array | stream.Readable): Promise<string> {
    const key = this.genKey()
    await new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Body: bytes,
        Key: this.getTmpPath(key),
      },
    }).done()
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
    await new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Body: bytes,
        Key: this.getStoredPath(cid),
      },
    }).done()
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

  async hasStored(cid: CID): Promise<boolean> {
    try {
      const res = await this.client.headObject({
        Bucket: this.bucket,
        Key: this.getStoredPath(cid),
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

  private async move(keys: { from: string; to: string }) {
    await this.client.copyObject({
      Bucket: this.bucket,
      CopySource: `${this.bucket}/${keys.from}`,
      Key: keys.to,
    })
    await this.client.deleteObject({
      Bucket: this.bucket,
      Key: keys.from,
    })
  }
}

export default S3BlobStore
