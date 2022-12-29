import { CID } from 'multiformats/cid'
import { check } from '@atproto/common'
import BlockMap from '../block-map'
import * as util from './util'
import { ReadableBlockstore, RepoStorage } from './types'

export class TempStorage implements ReadableBlockstore {
  constructor(
    public temp: ReadableBlockstore,
    public permanent: ReadableBlockstore,
  ) {}

  async getBytes(cid: CID): Promise<Uint8Array | null> {
    const got = await this.temp.getBytes(cid)
    if (got) return got
    return this.permanent.getBytes(cid)
  }

  async get<T>(cid: CID, schema: check.Def<T>): Promise<T> {
    return util.readObject(this, cid, schema)
  }

  async getBlocks(cids: CID[]): Promise<BlockMap> {
    const got = await this.temp.getBlocks(cids)
    const stillNeeded = cids.filter((cid) => !got.has(cid))
    const more = await this.permanent.getBlocks(stillNeeded)
    got.addMap(more)
    return got
  }

  async has(cid: CID): Promise<boolean> {
    return (await this.temp.has(cid)) || (await this.permanent.has(cid))
  }

  async checkMissing(cids: CID[]): Promise<CID[]> {
    const missingTemp = await this.temp.checkMissing(cids)
    return this.permanent.checkMissing(missingTemp)
  }

  //   async loadDiff(
  //     carBytes: Uint8Array,
  //     verify: (root: CID) => Promise<DataDiff>,
  //   ): Promise<{ root: CID; diff: DataDiff }> {
  //     const { root, blocks } = await util.readCar(carBytes)
  //     this.temp.addMap(blocks)
  //     try {
  //       const diff = await verify(root)
  //       await this.putMany(this.temp)
  //       this.temp.clear()
  //       return { root, diff }
  //     } catch (err) {
  //       this.temp.clear()
  //       throw err
  //     }
  //   }
}

export default TempStorage
