import MemoryDB from "./memory-db"

import * as Block from 'multiformats/block'
import { CID } from 'multiformats/cid'
import { sha256 as blockHasher } from 'multiformats/hashes/sha2'
import * as blockCodec from '@ipld/dag-cbor'

import { User } from "./types"

export default class IpldStore {

  db: MemoryDB

  constructor(db: MemoryDB) {
    this.db = db
  }

  async get (cid: CID): Promise<User> {
    const bytes = await this.db.get(cid)
    const block = await Block.create({ bytes, cid, codec: blockCodec, hasher: blockHasher })
    return block.value as User
  }

  async put (value: User): Promise<CID> {
    let block = await Block.encode({ value, codec: blockCodec, hasher: blockHasher })
    await this.db.put(block.cid, block.bytes)
    return block.cid
  }
}
