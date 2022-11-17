import { CID } from 'multiformats/cid'
import { BlockWriter } from '@ipld/car/writer'

import * as common from '@atproto/common'
import { check, util, valueToIpldBlock } from '@atproto/common'
import { BlockReader } from '@ipld/car/api'
import CidSet from '../cid-set'
import { CarReader } from '@ipld/car/reader'

export abstract class IpldStore {
  staged: Map<string, Uint8Array>

  constructor() {
    this.staged = new Map()
  }

  abstract getSavedBytes(cid: CID): Promise<Uint8Array | null>
  abstract hasSavedBlock(cid: CID): Promise<boolean>
  abstract saveStaged(): Promise<void>
  abstract destroySaved(): Promise<void>

  async stageBytes(k: CID, v: Uint8Array): Promise<void> {
    this.staged.set(k.toString(), v)
  }

  async stage(value: unknown): Promise<CID> {
    const block = await valueToIpldBlock(value)
    await this.stageBytes(block.cid, block.bytes)
    return block.cid
  }

  async getBytes(cid: CID): Promise<Uint8Array> {
    const fromStaged = this.staged.get(cid.toString())
    if (fromStaged) return fromStaged
    const fromBlocks = await this.getSavedBytes(cid)
    if (fromBlocks) return fromBlocks
    throw new Error(`Not found: ${cid.toString()}`)
  }

  async get<T>(cid: CID, schema: check.Def<T>): Promise<T> {
    const value = await this.getUnchecked(cid)
    try {
      return check.assure(schema, value)
    } catch (err) {
      throw new Error(
        `Did not find expected object at ${cid.toString()}: ${err}`,
      )
    }
  }

  async getUnchecked(cid: CID): Promise<unknown> {
    const bytes = await this.getBytes(cid)
    return common.ipldBytesToValue(bytes)
  }

  async has(cid: CID): Promise<boolean> {
    return this.staged.has(cid.toString()) || this.hasSavedBlock(cid)
  }

  async isMissing(cid: CID): Promise<boolean> {
    const has = await this.has(cid)
    return !has
  }

  async checkMissing(cids: CidSet): Promise<CidSet> {
    const missing = await util.asyncFilter(cids.toList(), (c) => {
      return this.isMissing(c)
    })
    return new CidSet(missing)
  }

  async clearStaged(): Promise<void> {
    this.staged.clear()
  }

  async destroy(): Promise<void> {
    this.clearStaged()
    await this.destroySaved()
  }

  async addToCar(car: BlockWriter, cid: CID) {
    car.put({ cid, bytes: await this.getBytes(cid) })
  }

  async stageCar(buf: Uint8Array): Promise<CID> {
    const car = await CarReader.fromBytes(buf)
    const roots = await car.getRoots()
    if (roots.length !== 1) {
      throw new Error(`Expected one root, got ${roots.length}`)
    }
    const rootCid = roots[0]
    await this.stageCarBlocks(car)
    return rootCid
  }

  async stageCarBlocks(car: BlockReader): Promise<void> {
    for await (const block of car.blocks()) {
      await this.stageBytes(block.cid, block.bytes)
    }
  }
}

export default IpldStore
