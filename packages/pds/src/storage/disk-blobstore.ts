import fs from 'fs'
import stream from 'stream'
import { CID } from 'multiformats/cid'
import { BlobStore } from '@atproto/repo'
import { randomStr } from '@atproto/crypto'
import { httpLogger as log } from '../logger'

export class DiskBlobStore implements BlobStore {
  location: string
  tmpLocation: string

  constructor(location: string, tmpLocation: string) {
    this.location = location
    this.tmpLocation = tmpLocation
  }

  static async create(
    location: string,
    tmpLocation?: string,
  ): Promise<DiskBlobStore> {
    const tmp = tmpLocation || '/tmp/atproto/blobs'
    await Promise.all([
      fs.promises.mkdir(location, { recursive: true }),
      fs.promises.mkdir(tmp, { recursive: true }),
    ])
    return new DiskBlobStore(location, tmp)
  }

  private genKey() {
    return randomStr(32, 'base32')
  }

  getTmpPath(key: string): string {
    return `${this.tmpLocation}/${key}`
  }

  getStoredPath(cid: CID): string {
    return `${this.location}/${cid.toString()}`
  }

  async hasTemp(key: string): Promise<boolean> {
    return fileExists(this.getTmpPath(key))
  }

  async hasStored(cid: CID): Promise<boolean> {
    return fileExists(this.getStoredPath(cid))
  }

  async putTemp(bytes: Uint8Array | stream.Readable): Promise<string> {
    const key = this.genKey()
    await fs.promises.writeFile(this.getTmpPath(key), bytes)
    return key
  }

  async makePermanent(key: string, cid: CID): Promise<void> {
    const tmpPath = this.getTmpPath(key)
    const storedPath = this.getStoredPath(cid)
    const alreadyHas = await this.hasStored(cid)
    if (!alreadyHas) {
      const data = await fs.promises.readFile(tmpPath)
      await fs.promises.writeFile(storedPath, data)
    }
    try {
      await fs.promises.rm(tmpPath)
    } catch (err) {
      log.error({ err, tmpPath }, 'could not delete file from temp storage')
    }
  }

  async getBytes(cid: CID): Promise<Uint8Array> {
    return fs.promises.readFile(this.getStoredPath(cid))
  }

  getStream(cid: CID): stream.Readable {
    return fs.createReadStream(this.getStoredPath(cid))
  }
}

const fileExists = (location: string): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    fs.stat(location, (err) => {
      if (err) {
        if (err.code === 'ENOENT') {
          return resolve(false)
        } else {
          return reject(err)
        }
      } else {
        resolve(true)
      }
    })
  })
}

export default DiskBlobStore
