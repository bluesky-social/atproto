import { CID } from 'multiformats'
import { sha256 as blockHasher } from 'multiformats/hashes/sha2'
import * as blockCodec from '@ipld/dag-cbor'
import * as HAMT from 'ipld-hashmap'
import { BlockWriter } from '@ipld/car/lib/writer-browser'

import IpldStore from '../blockstore/ipld-store.js'
import { CarStreamable, Follow, schema, UpdateData } from './types.js'
import { DID } from '../common/types.js'
import CidSet from './cid-set.js'

export class Relationships implements CarStreamable {
  blockstore: IpldStore
  cid: CID
  hamt: HAMT.HashMap<CID>
  onUpdate: ((update: UpdateData) => Promise<void>) | null

  constructor(blockstore: IpldStore, cid: CID, hamt: HAMT.HashMap<CID>) {
    this.blockstore = blockstore
    this.cid = cid
    this.hamt = hamt
    this.onUpdate = null
  }

  static async create(blockstore: IpldStore): Promise<Relationships> {
    const hamt = (await HAMT.create(
      blockstore.rawBlockstore,
      HAMT_OPTS,
    )) as HAMT.HashMap<CID>
    return new Relationships(blockstore, hamt.cid, hamt)
  }

  static async load(blockstore: IpldStore, cid: CID): Promise<Relationships> {
    const hamt = (await HAMT.load(
      blockstore.rawBlockstore,
      cid,
      HAMT_OPTS,
    )) as HAMT.HashMap<CID>
    return new Relationships(blockstore, hamt.cid, hamt)
  }

  async updateRoot(newCids: CidSet): Promise<void> {
    this.cid = this.hamt.cid
    if (this.onUpdate) {
      await this.onUpdate({ namespace: 'relationships', newCids })
    }
  }

  async getFollow(did: DID): Promise<Follow | null> {
    const cid = await this.hamt.get(did)
    if (!cid) return null
    return this.blockstore.get(cid, schema.follow)
  }

  async isFollowing(did: DID): Promise<boolean> {
    return this.hamt.has(did)
  }

  async follow(did: DID, username: string): Promise<void> {
    const isFollowing = await this.isFollowing(did)
    if (isFollowing) {
      throw new Error(`Entry already exists for did ${did}`)
    }
    const follow: Follow = { did, username }
    const cid = await this.blockstore.put(follow)
    await this.runOnHamt((hamt) => hamt.set(did, cid))
  }

  async unfollow(did: DID): Promise<void> {
    const isFollowing = await this.isFollowing(did)
    if (!isFollowing) {
      throw new Error(`Entry does not exist for did ${did}`)
    }
    await this.runOnHamt((hamt) => hamt.delete(did))
  }

  async getFollows(): Promise<Follow[]> {
    const cids = await this.getEntries()
    const follows = await Promise.all(
      cids.map((c) => this.blockstore.get(c, schema.follow)),
    )
    return follows
  }

  async getEntries(): Promise<CID[]> {
    const cids: CID[] = []
    for await (const entry of this.hamt.entries()) {
      cids.push(entry[1])
    }
    return cids
  }

  // @TODO: clearly not the best way to get the newly added CIDs
  // but we either need to make changes to upstream or our own impl
  async runOnHamt(
    fn: (hamt: HAMT.HashMap<CID>) => Promise<void>,
  ): Promise<void> {
    const cidsBefore = new CidSet(await this.cids())
    await fn(this.hamt)
    const cidsAfter = new CidSet(await this.cids())
    const newCids = cidsAfter.subtractSet(cidsBefore)
    await this.updateRoot(newCids)
  }

  async cids(): Promise<CID[]> {
    const structure: CID[] = []
    for await (const cid of this.hamt.cids()) {
      structure.push(cid)
    }
    const entries = await this.getEntries()
    return structure.concat(entries)
  }

  async writeToCarStream(car: BlockWriter): Promise<void> {
    for await (const cid of this.hamt.cids()) {
      await this.blockstore.addToCar(car, cid)
    }
    for await (const entry of this.hamt.entries()) {
      await this.blockstore.addToCar(car, entry[1])
    }
  }
}

// bitWidth of 5 means 32-wide trees
const HAMT_OPTS = {
  bitWidth: 5,
  bucketSize: 3,
  blockHasher,
  blockCodec,
}

export default Relationships
