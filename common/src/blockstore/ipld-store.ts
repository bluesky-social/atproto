import * as Block from 'multiformats/block'
import { CID } from 'multiformats/cid'
import { sha256 as blockHasher } from 'multiformats/hashes/sha2'
import * as blockCodec from '@ipld/dag-cbor'
import { BlockWriter } from '@ipld/car/writer'

import MemoryBlockstore from './memory-blockstore.js'
import * as check from '../common/check.js'
import * as util from '../common/util.js'
import { BlockstoreI } from './types.js'
import { PersistentBlockstore } from './persistent-blockstore.js'
import { BlockReader } from '@ipld/car/api'
import CidSet from '../repo/cid-set.js'

type AllowedIpldRecordVal = string | number | CID | CID[] | Uint8Array | null

export type AllowedIpldVal =
  | AllowedIpldRecordVal
  | Record<string, AllowedIpldRecordVal>

export class IpldStore {
  rawBlockstore: BlockstoreI

  constructor(rawBlockstore: BlockstoreI) {
    this.rawBlockstore = rawBlockstore
  }

  static createInMemory(): IpldStore {
    return new IpldStore(new MemoryBlockstore())
  }

  static createPersistent(location = 'blockstore'): IpldStore {
    return new IpldStore(new PersistentBlockstore(location))
  }

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

  async get<T>(cid: CID, schema: check.Schema<T>): Promise<T> {
    const bytes = await this.getBytes(cid)
    const block = await Block.create({
      bytes,
      cid,
      codec: blockCodec,
      hasher: blockHasher,
    })
    try {
      const verified = check.assure(schema, block.value)
      return verified
    } catch (err) {
      throw new Error(
        `Did not find expected object at ${cid.toString()}: ${err}`,
      )
    }
  }

  async has(cid: CID): Promise<boolean> {
    return this.rawBlockstore.has(cid)
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

  async getBytes(cid: CID): Promise<Uint8Array> {
    return this.rawBlockstore.get(cid)
  }

  async putBytes(cid: CID, bytes: Uint8Array): Promise<void> {
    return this.rawBlockstore.put(cid, bytes)
  }

  async destroy(): Promise<void> {
    return this.rawBlockstore.destroy()
  }

  async addToCar(car: BlockWriter, cid: CID) {
    car.put({ cid, bytes: await this.getBytes(cid) })
  }

  async loadCar(car: BlockReader): Promise<void> {
    for await (const block of car.blocks()) {
      await this.putBytes(block.cid, block.bytes)
    }
  }
}

export default IpldStore
