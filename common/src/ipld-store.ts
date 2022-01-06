import MemoryDB from "./memory-db"

import * as Block from 'multiformats/block'
import { CID } from 'multiformats/cid'
import { sha256 as blockHasher } from 'multiformats/hashes/sha2'
import * as blockCodec from '@ipld/dag-cbor'

import { SignedRoot, User } from "./types"
import * as check from './type-check'

export class IpldStore {

  db: MemoryDB

  constructor(db: MemoryDB) {
    this.db = db
  }

  async get (cid: CID): Promise<Object> {
    const bytes = await this.db.get(cid)
    const block = await Block.create({ bytes, cid, codec: blockCodec, hasher: blockHasher })
    return block.value as User
  }

  async getUser (cid: CID): Promise<User> {
    const obj = await this.get(cid)
    if (!check.isUser(obj)) {
      throw new Error(`Could not find a user at ${cid.toString()}`)
    }
    return obj
  }

  async getSignedRoot (cid: CID): Promise<SignedRoot> {
    const obj = await this.get(cid)
    if (!check.isSignedRoot(obj)) {
      throw new Error(`Could not find a signed root at ${cid.toString()}`)
    }
    return obj
  }

  async put (value: Object): Promise<CID> {
    let block = await Block.encode({ value, codec: blockCodec, hasher: blockHasher })
    await this.db.put(block.cid, block.bytes)
    return block.cid
  }
}

export default IpldStore 
