import fs from 'fs/promises'
import fsSync from 'fs'
import stream from 'stream'
import path from 'path'
import { CID } from 'multiformats/cid'
import { BlobNotFoundError, BlobStore } from '@atproto/repo'
import { randomStr } from '@atproto/crypto'
import { httpLogger as log } from './logger'
import { isErrnoException, fileExists, rmIfExists } from '@atproto/common'

export class DiskBlobStore implements BlobStore {
  constructor(
    public did: string,
    public location: string,
    public tmpLocation: string,
    public quarantineLocation: string,
  ) {}

  static creator(
    location: string,
    tmpLocation?: string,
    quarantineLocation?: string,
  ) {
    return (did: string) => {
      const tmp = tmpLocation || path.join(location, 'tempt')
      const quarantine = quarantineLocation || path.join(location, 'quarantine')
      return new DiskBlobStore(did, location, tmp, quarantine)
    }
  }

  private async ensureDir() {
    await fs.mkdir(path.join(this.location, this.did), { recursive: true })
  }

  private async ensureTemp() {
    await fs.mkdir(path.join(this.tmpLocation, this.did), { recursive: true })
  }

  private async ensureQuarantine() {
    await fs.mkdir(path.join(this.quarantineLocation, this.did), {
      recursive: true,
    })
  }

  private genKey() {
    return randomStr(32, 'base32')
  }

  getTmpPath(key: string): string {
    return path.join(this.tmpLocation, this.did, key)
  }

  getStoredPath(cid: CID): string {
    return path.join(this.location, this.did, cid.toString())
  }

  getQuarantinePath(cid: CID): string {
    return path.join(this.quarantineLocation, this.did, cid.toString())
  }

  async hasTemp(key: string): Promise<boolean> {
    return fileExists(this.getTmpPath(key))
  }

  async hasStored(cid: CID): Promise<boolean> {
    return fileExists(this.getStoredPath(cid))
  }

  async putTemp(bytes: Uint8Array | stream.Readable): Promise<string> {
    await this.ensureTemp()
    const key = this.genKey()
    await fs.writeFile(this.getTmpPath(key), bytes)
    return key
  }

  async makePermanent(key: string, cid: CID): Promise<void> {
    await this.ensureDir()
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
    await this.ensureDir()
    await fs.writeFile(this.getStoredPath(cid), bytes)
  }

  async quarantine(cid: CID): Promise<void> {
    await this.ensureQuarantine()
    try {
      await fs.rename(this.getStoredPath(cid), this.getQuarantinePath(cid))
    } catch (err) {
      throw translateErr(err)
    }
  }

  async unquarantine(cid: CID): Promise<void> {
    await this.ensureDir()
    try {
      await fs.rename(this.getQuarantinePath(cid), this.getStoredPath(cid))
    } catch (err) {
      throw translateErr(err)
    }
  }

  async getBytes(cid: CID): Promise<Uint8Array> {
    try {
      return await fs.readFile(this.getStoredPath(cid))
    } catch (err) {
      throw translateErr(err)
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
    await rmIfExists(this.getStoredPath(cid))
  }

  async deleteMany(cids: CID[]): Promise<void> {
    await Promise.all(cids.map((cid) => this.delete(cid)))
  }

  async deleteAll(): Promise<void> {
    await rmIfExists(this.location, true)
  }
}

const translateErr = (err: unknown): BlobNotFoundError | unknown => {
  if (isErrnoException(err) && err.code === 'ENOENT') {
    return new BlobNotFoundError()
  }
  return err
}

export default DiskBlobStore
