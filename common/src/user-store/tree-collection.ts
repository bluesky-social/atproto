import { CID } from 'multiformats'
import * as HAMT from 'ipld-hashmap'
import { sha256 as blockHasher } from 'multiformats/hashes/sha2'
import * as blockCodec from '@ipld/dag-cbor'

import IpldStore from '../blockstore/ipld-store'
import { Collection, DID } from './types'

export class TreeCollection implements Collection<DID> {
  store: IpldStore
  cid: CID
  hamt: HAMT.HashMap<CID>

  constructor(store: IpldStore, cid: CID, hamt: HAMT.HashMap<CID>) {
    this.store = store
    this.cid = cid
    this.hamt = hamt
  }

  static async create(store: IpldStore): Promise<TreeCollection> {
    const hamt = (await HAMT.create(
      store.blockstore,
      HAMT_OPTS,
    )) as HAMT.HashMap<CID>
    return new TreeCollection(store, hamt.cid, hamt)
  }

  static async get(store: IpldStore, cid: CID): Promise<TreeCollection> {
    const hamt = (await HAMT.load(
      store.blockstore,
      cid,
      HAMT_OPTS,
    )) as HAMT.HashMap<CID>
    return new TreeCollection(store, hamt.cid, hamt)
  }

  async getEntry(id: DID): Promise<CID | null> {
    const got = await this.hamt.get(id)
    return got || null
  }

  async hasEntry(id: DID): Promise<boolean> {
    return this.hamt.has(id)
  }

  async addEntry(id: DID, cid: CID): Promise<void> {
    const exists = await this.hasEntry(id)
    if (exists) {
      throw new Error(`Entry already exists for id ${id}`)
    }
    await this.hamt.set(id, cid)
    this.cid = this.hamt.cid
  }

  async editEntry(id: DID, cid: CID): Promise<void> {
    const exists = await this.hasEntry(id)
    if (!exists) {
      throw new Error(`Entry does not exist for id ${id}`)
    }
    await this.hamt.set(id, cid)
    this.cid = this.hamt.cid
  }

  async deleteEntry(id: DID): Promise<void> {
    const exists = await this.hasEntry(id)
    if (!exists) {
      throw new Error(`Entry does not exist for id ${id}`)
    }
    await this.hamt.delete(id)
    this.cid = this.hamt.cid
  }

  async getEntries(): Promise<CID[]> {
    const cids: CID[] = []
    for await (const entry of this.hamt.entries()) {
      cids.push(entry[1])
    }
    return cids
  }

  async cids(): Promise<CID[]> {
    const structure: CID[] = []
    for await (const cid of this.hamt.cids()) {
      structure.push(cid)
    }
    const entries = await this.getEntries()
    return structure.concat(entries)
  }
}

const HAMT_OPTS = {
  bitWidth: 5,
  bucketSize: 3,
  blockHasher,
  blockCodec,
}

export default TreeCollection
