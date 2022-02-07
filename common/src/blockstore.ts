import level from 'level'
import * as Block from 'multiformats/block'
import { CID } from 'multiformats/cid'
import { sha256 as blockHasher } from 'multiformats/hashes/sha2'
import * as blockCodec from '@ipld/dag-cbor'

import { BlockstoreI } from './types.js'

export class Blockstore implements BlockstoreI {

  store: level.LevelDB

  constructor(location = 'blockstore') {
    this.store = level(location, { 
      valueEncoding: 'binary',
      compression: false
    })
  }

  async get(cid: CID): Promise<Uint8Array> {
    return this.store.get(cid.toString())
  }

  async put(cid: CID, bytes: Uint8Array): Promise<void> {
    await this.store.put(cid.toString(), bytes)
  }

  async putIpld(value: Object): Promise<CID> {
    const block = await Block.encode({ value, codec: blockCodec, hasher: blockHasher })
    await this.put(block.cid, block.bytes)
    return block.cid
  }

  async getIpld<T>(cid: CID, checkFn: (obj: unknown) => T): Promise<T> {{
    const bytes = await this.get(cid)
    const block = await Block.create({ bytes, cid, codec: blockCodec, hasher: blockHasher })
    try {
      const verified = checkFn(block.value)
      return verified
    } catch (err: any) {
      throw new Error(`Did not find expected object at ${cid.toString()}: ${err.toString()}`)
    }
  }}

  async destroy(): Promise<void> {
    await this.store.clear()
    await this.store.close()
  }

}

export default Blockstore
