import * as Block from 'multiformats/block'
import { CID } from 'multiformats/cid'
import { sha256 as blockHasher } from 'multiformats/hashes/sha2'
import * as blockCodec from '@ipld/dag-cbor'
import { BlockWriter } from '@ipld/car/writer'

import { check, util } from '@atproto/common'
import { BlockReader } from '@ipld/car/api'
import CidSet from '../cid-set'
import { CarReader } from '@ipld/car/reader'

type AllowedIpldRecordVal = string | number | CID | CID[] | Uint8Array | null

export type AllowedIpldVal =
  | AllowedIpldRecordVal
  | Record<string, AllowedIpldRecordVal>

export abstract class IpldStore {
  abstract has(cid: CID): Promise<boolean>
  abstract getBytes(cid: CID): Promise<Uint8Array>
  abstract putBytes(cid: CID, bytes: Uint8Array): Promise<void>
  abstract destroy(): Promise<void>

  async put(
    value: Record<string, AllowedIpldVal> | AllowedIpldVal,
  ): Promise<CID> {
    const block = await Block.encode({
      value,
      codec: blockCodec,
      hasher: blockHasher,
    })
    await this.putBytes(block.cid, block.bytes)
    return block.cid
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
    const block = await Block.create({
      bytes,
      cid,
      codec: blockCodec,
      hasher: blockHasher,
    })
    return block.value
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

  async addToCar(car: BlockWriter, cid: CID) {
    car.put({ cid, bytes: await this.getBytes(cid) })
  }

  async loadCar(buf: Uint8Array): Promise<CID> {
    const car = await CarReader.fromBytes(buf)
    const roots = await car.getRoots()
    if (roots.length !== 1) {
      throw new Error(`Expected one root, got ${roots.length}`)
    }
    const rootCid = roots[0]
    await this.loadCarBlocks(car)
    return rootCid
  }

  async loadCarBlocks(car: BlockReader): Promise<void> {
    for await (const block of car.blocks()) {
      await this.putBytes(block.cid, block.bytes)
    }
  }
}

export default IpldStore
