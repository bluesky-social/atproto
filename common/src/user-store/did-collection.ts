import { CID } from 'multiformats'
import { sha256 as blockHasher } from 'multiformats/hashes/sha2'
import * as blockCodec from '@ipld/dag-cbor'
import * as HAMT from 'ipld-hashmap'
import { BlockWriter } from '@ipld/car/lib/writer-browser'

import IpldStore from '../blockstore/ipld-store.js'
import { CarStreamable, Collection, NewCids } from './types.js'
import { DID } from '../common/types.js'

export class DidCollection implements Collection<DID>, CarStreamable {
  store: IpldStore
  cid: CID
  hamt: HAMT.HashMap<CID>
  onUpdate: ((newCids: NewCids) => Promise<void>) | null

  constructor(store: IpldStore, cid: CID, hamt: HAMT.HashMap<CID>) {
    this.store = store
    this.cid = cid
    this.hamt = hamt
    this.onUpdate = null
  }

  static async create(store: IpldStore): Promise<DidCollection> {
    const hamt = (await HAMT.create(
      store.blockstore,
      HAMT_OPTS,
    )) as HAMT.HashMap<CID>
    return new DidCollection(store, hamt.cid, hamt)
  }

  static async load(store: IpldStore, cid: CID): Promise<DidCollection> {
    const hamt = (await HAMT.load(
      store.blockstore,
      cid,
      HAMT_OPTS,
    )) as HAMT.HashMap<CID>
    return new DidCollection(store, hamt.cid, hamt)
  }

  async updateRoot(): Promise<void> {
    this.cid = this.hamt.cid
    if (this.onUpdate) {
      // @TODO either remove this class tree from data store, or actually send update
      // send empty NewCids array for now
      await this.onUpdate([])
    }
  }

  async getEntry(did: DID): Promise<CID | null> {
    const got = await this.hamt.get(did)
    return got || null
  }

  async hasEntry(did: DID): Promise<boolean> {
    return this.hamt.has(did)
  }

  async addEntry(did: DID, cid: CID): Promise<void> {
    const exists = await this.hasEntry(did)
    if (exists) {
      throw new Error(`Entry already exists for did ${did}`)
    }
    await this.hamt.set(did, cid)
    await this.updateRoot()
  }

  async editEntry(did: DID, cid: CID): Promise<void> {
    const exists = await this.hasEntry(did)
    if (!exists) {
      throw new Error(`Entry does not exist for did ${did}`)
    }
    await this.hamt.set(did, cid)
    await this.updateRoot()
  }

  async deleteEntry(did: DID): Promise<void> {
    const exists = await this.hasEntry(did)
    if (!exists) {
      throw new Error(`Entry does not exist for did ${did}`)
    }
    await this.hamt.delete(did)
    await this.updateRoot()
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

  async writeToCarStream(car: BlockWriter): Promise<void> {
    for await (const cid of this.hamt.cids()) {
      await this.store.addToCar(car, cid)
    }
    for await (const entry of this.hamt.entries()) {
      await this.store.addToCar(car, entry[1])
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

export default DidCollection
