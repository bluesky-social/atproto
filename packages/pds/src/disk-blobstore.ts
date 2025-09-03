import fsSync from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import stream from 'node:stream'
import { CID } from 'multiformats/cid'
import {
  chunkArray,
  fileExists,
  isErrnoException,
  rmIfExists,
} from '@atproto/common'
import { randomStr } from '@atproto/crypto'
import { BlobNotFoundError, BlobStore } from '@atproto/repo'
import { blobStoreLogger as log } from './logger'

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

    try {
      await fs.rename(tmpPath, storedPath)
    } catch (err) {
      if (err instanceof Error && err['code'] === 'ENOENT') {
        // Blob was not found from temp storage...
        const alreadyHas = await this.hasStored(cid)
        // already saved, so we no-op
        if (alreadyHas) return

        throw new BlobNotFoundError()
      }

      log.error(
        { err, tmpPath, storedPath },
        'could not move file to permanent storage',
      )

      throw err
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
    for (const chunk of chunkArray(cids, 500)) {
      await Promise.all(chunk.map((cid) => this.delete(cid)))
    }
  }

  async deleteAll(): Promise<void> {
    await rmIfExists(path.join(this.location, this.did), true)
    await rmIfExists(path.join(this.tmpLocation, this.did), true)
    await rmIfExists(path.join(this.quarantineLocation, this.did), true)
  }
}

const translateErr = (err: unknown): BlobNotFoundError | unknown => {
  if (isErrnoException(err) && err.code === 'ENOENT') {
    return new BlobNotFoundError()
  }
  return err
}
