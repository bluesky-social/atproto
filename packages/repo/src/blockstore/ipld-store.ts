import { CID } from 'multiformats/cid'
import { BlockWriter } from '@ipld/car/writer'

import * as common from '@atproto/common'
import { check, util, valueToIpldBlock } from '@atproto/common'
import { CarReader } from '@ipld/car/reader'
import { DataDiff } from '../mst'

export abstract class IpldStore {
  staged: Map<string, Uint8Array>
  temp: Map<string, Uint8Array>

  constructor() {
    this.staged = new Map()
  }

  abstract getSavedBytes(cid: CID): Promise<Uint8Array | null>
  abstract hasSavedBlock(cid: CID): Promise<boolean>
  abstract saveMany(blocks: Map<string, Uint8Array>): Promise<void>
  abstract commitStaged(commit: CID): Promise<void>
  abstract getCommitPath(
    latest: CID,
    earliest: CID | null,
  ): Promise<CID[] | null>
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

  async loadDiff(
    buf: Uint8Array,
    verify: (root: CID) => Promise<DataDiff>,
  ): Promise<{ root: CID; diff: DataDiff }> {
    const car = await CarReader.fromBytes(buf)
    const roots = await car.getRoots()
    if (roots.length !== 1) {
      throw new Error(`Expected one root, got ${roots.length}`)
    }
    const root = roots[0]
    for await (const block of car.blocks()) {
      this.temp.set(block.cid.toString(), block.bytes)
    }
    try {
      const diff = await verify(root)
      await this.saveMany(this.temp)
      this.temp.clear()
      return { root, diff }
    } catch (err) {
      this.temp.clear()
      throw err
    }
  }
}

export default IpldStore
