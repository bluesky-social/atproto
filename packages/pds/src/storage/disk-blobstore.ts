import fs from 'fs/promises'
import fsSync from 'fs'
import stream from 'stream'
import os from 'os'
import path from 'path'
import { CID } from 'multiformats/cid'
import { BlobNotFoundError, BlobStore } from '@atproto/repo'
import { randomStr } from '@atproto/crypto'
import { httpLogger as log } from '../logger'
import { isErrnoException, fileExists } from '@atproto/common'

export class DiskBlobStore implements BlobStore {
  location: string
  tmpLocation: string
  quarantineLocation: string

  constructor(
    location: string,
    tmpLocation: string,
    quarantineLocation: string,
  ) {
    this.location = location
    this.tmpLocation = tmpLocation
    this.quarantineLocation = quarantineLocation
  }

  static async create(
    location: string,
    tmpLocation?: string,
    quarantineLocation?: string,
  ): Promise<DiskBlobStore> {
    const tmp = tmpLocation || path.join(os.tmpdir(), 'atproto/blobs')
    const quarantine =
      quarantineLocation || path.join(os.tmpdir(), 'atproto/blobs/quarantine')
    await Promise.all([
      fs.mkdir(location, { recursive: true }),
      fs.mkdir(tmp, { recursive: true }),
      fs.mkdir(quarantine, { recursive: true }),
    ])
    return new DiskBlobStore(location, tmp, quarantine)
  }

  private genKey() {
    return randomStr(32, 'base32')
  }

  getTmpPath(key: string): string {
    return path.join(this.tmpLocation, key)
  }

  getStoredPath(cid: CID): string {
    return path.join(this.location, cid.toString())
  }

  getQuarantinePath(cid: CID): string {
    return path.join(this.quarantineLocation, cid.toString())
  }

  async hasTemp(key: string): Promise<boolean> {
    return fileExists(this.getTmpPath(key))
  }

  async hasStored(cid: CID): Promise<boolean> {
    return fileExists(this.getStoredPath(cid))
  }

  async putTemp(bytes: Uint8Array | stream.Readable): Promise<string> {
    const key = this.genKey()
    await fs.writeFile(this.getTmpPath(key), bytes)
    return key
  }

  async makePermanent(key: string, cid: CID): Promise<void> {
    const tmpPath = this.getTmpPath(key)
    const storedPath = this.getStoredPath(cid)
    const alreadyHas = await this.hasStored(cid)
    if (!alreadyHas) {
      const data = await fs.readFile(tmpPath)
      await fs.writeFile(storedPath, data)
    }
    try {
      await fs.rm(tmpPath)
    } catch (err) {
      log.error({ err, tmpPath }, 'could not delete file from temp storage')
    }
  }

  async putPermanent(
    cid: CID,
    bytes: Uint8Array | stream.Readable,
  ): Promise<void> {
    await fs.writeFile(this.getStoredPath(cid), bytes)
  }

  async quarantine(cid: CID): Promise<void> {
    await fs.rename(this.getStoredPath(cid), this.getQuarantinePath(cid))
  }

  async unquarantine(cid: CID): Promise<void> {
    await fs.rename(this.getQuarantinePath(cid), this.getStoredPath(cid))
  }

  async getBytes(cid: CID): Promise<Uint8Array> {
    try {
      return await fs.readFile(this.getStoredPath(cid))
    } catch (err) {
      if (isErrnoException(err) && err.code === 'ENOENT') {
        throw new BlobNotFoundError()
      }
      throw err
    }
  }

  async getStream(cid: CID): Promise<stream.Readable> {
    const path = this.getStoredPath(cid)
    const exists = await fileExists(path)
    if (!exists) {
      throw new BlobNotFoundError()
    }
    return fsSync.createReadStream(path)
  }

  async delete(cid: CID): Promise<void> {
    await fs.rm(this.getStoredPath(cid))
  }
}

export default DiskBlobStore
