import { CID } from 'multiformats/cid'
import { check } from '@atproto/common'
import BlockMap from '../block-map'
import * as util from './util'
import { ReadableBlockstore } from './types'

export class SyncStorage implements ReadableBlockstore {
  constructor(
    public staged: ReadableBlockstore,
    public saved: ReadableBlockstore,
  ) {}

  async getBytes(cid: CID): Promise<Uint8Array | null> {
    const got = await this.staged.getBytes(cid)
    if (got) return got
    return this.saved.getBytes(cid)
  }

  async get<T>(cid: CID, schema: check.Def<T>): Promise<T> {
    return util.readObject(this, cid, schema)
  }

  async getBlocks(cids: CID[]): Promise<BlockMap> {
    const got = await this.staged.getBlocks(cids)
    const stillNeeded = cids.filter((cid) => !got.has(cid))
    const more = await this.saved.getBlocks(stillNeeded)
    got.addMap(more)
    return got
  }

  async has(cid: CID): Promise<boolean> {
    return (await this.staged.has(cid)) || (await this.saved.has(cid))
  }

  async checkMissing(cids: CID[]): Promise<CID[]> {
    const missingTemp = await this.staged.checkMissing(cids)
    return this.saved.checkMissing(missingTemp)
  }
}

export default SyncStorage
