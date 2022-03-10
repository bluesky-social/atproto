import * as Block from 'multiformats/block'
import { CID } from 'multiformats/cid'
import { sha256 as blockHasher } from 'multiformats/hashes/sha2'
import * as blockCodec from '@ipld/dag-cbor'
import { BlockWriter } from '@ipld/car/writer'

import MemoryBlockstore from './memory-blockstore.js'
import * as check from '../common/check.js'
import { BlockstoreI } from './types.js'
import { PersistentBlockstore } from './persistent-blockstore.js'

export class IpldStore {
  blockstore: BlockstoreI

  constructor(blockstore: BlockstoreI) {
    this.blockstore = blockstore
  }

  static createInMemory(): IpldStore {
    return new IpldStore(new MemoryBlockstore())
  }

  static createPersistent(location = 'blockstore'): IpldStore {
    return new IpldStore(new PersistentBlockstore(location))
  }

  async put(value: Record<string, unknown> | string): Promise<CID> {
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

  async getBytes(cid: CID): Promise<Uint8Array> {
    return this.blockstore.get(cid)
  }

  async putBytes(cid: CID, bytes: Uint8Array): Promise<void> {
    return this.blockstore.put(cid, bytes)
  }

  async destroy(): Promise<void> {
    return this.blockstore.destroy()
  }

  async addToCar(car: BlockWriter, cid: CID) {
    car.put({ cid, bytes: await this.getBytes(cid) })
  }
}

export default IpldStore
