import * as aws from '@aws-sdk/client-s3'
import { BlobStore } from '@atproto/repo'
import { randomStr } from '@atproto/crypto'
import { CID } from 'multiformats/cid'
import stream from 'stream'

export type S3Config = { bucket: string } & Omit<
  aws.S3ClientConfig,
  'apiVersion'
>

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

  async putTemp(bytes: Uint8Array | stream.Readable): Promise<string> {
    const key = this.genKey()
    await this.client.putObject({
      Bucket: this.bucket,
      Body: bytes,
      Key: this.getTmpPath(key),
    })
    return key
  }

  async makePermanent(key: string, cid: CID): Promise<void> {
    const tmpPath = this.getTmpPath(key)
    await this.client.copyObject({
      Bucket: this.bucket,
      CopySource: `${this.bucket}/${tmpPath}`,
      Key: this.getStoredPath(cid),
    })

    await this.client.deleteObject({
      Bucket: this.bucket,
      Key: tmpPath,
    })
  }

  async putPermanent(
    cid: CID,
    bytes: Uint8Array | stream.Readable,
  ): Promise<void> {
    await this.client.putObject({
      Bucket: this.bucket,
      Body: bytes,
      Key: this.getStoredPath(cid),
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
      throw new Error(`Could not get blob: ${cid.toString()}`)
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
}

export default S3BlobStore
