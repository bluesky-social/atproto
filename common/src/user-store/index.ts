import { CID } from 'multiformats/cid'
import { CarReader, CarWriter } from '@ipld/car'
import { BlockWriter } from '@ipld/car/lib/writer-browser'

import { Didable, Keypair } from 'ucans'

import { UserRoot, CarStreamable, IdMapping } from './types.js'
import { DID } from '../common/types.js'
import * as check from './type-check.js'
import IpldStore from '../blockstore/ipld-store.js'
import { streamToArray } from '../common/util.js'
import SchemaStore from './schema-store.js'

export class UserStore implements CarStreamable {
  store: IpldStore
  schemaCids: IdMapping
  schemas: { [name: string]: SchemaStore }
  cid: CID
  did: DID
  keypair: Keypair | null

  constructor(params: {
    store: IpldStore
    schemaCids: IdMapping
    cid: CID
    did: DID
    keypair?: Keypair
  }) {
    this.store = params.store
    this.schemaCids = params.schemaCids
    this.schemas = {}
    this.cid = params.cid
    this.did = params.did
    this.keypair = params.keypair || null
  }

  static async create(store: IpldStore, keypair: Keypair & Didable) {
    const did = await keypair.did()

    const rootObj = {
      did: did,
    }

    const rootCid = await store.put(rootObj)
    const commit = {
      root: rootCid,
      sig: await keypair.sign(rootCid.bytes),
    }

    const cid = await store.put(commit)
    const schemaCids: IdMapping = {}
    const schemas = {}

    return new UserStore({
      store,
      schemaCids,
      cid,
      did,
      keypair,
    })
  }

  static async load(cid: CID, store: IpldStore, keypair?: Keypair) {
    const commit = await store.get(cid, check.assureCommit)
    const rootObj = await store.get(commit.root, check.assureUserRoot)
    const { did, ...schemaCids } = rootObj
    return new UserStore({
      store,
      schemaCids,
      cid,
      did,
      keypair,
    })
  }

  static async fromCarFile(
    buf: Uint8Array,
    store: IpldStore,
    keypair?: Keypair,
  ) {
    const car = await CarReader.fromBytes(buf)

    const roots = await car.getRoots()
    if (roots.length !== 1) {
      throw new Error(`Expected one root, got ${roots.length}`)
    }
    const root = roots[0]

    for await (const block of car.blocks()) {
      await store.putBytes(block.cid, block.bytes)
    }

    return UserStore.load(root, store, keypair)
  }

  async updateRoot(): Promise<void> {
    if (this.keypair === null) {
      throw new Error('No keypair provided. UserStore is read-only.')
    }
    const userCid = await this.store.put({
      did: this.did,
      ...this.schemas,
    })
    const commit = {
      user: userCid,
      sig: await this.keypair.sign(userCid.bytes),
    }
    this.cid = await this.store.put(commit)
  }

  async getRoot(): Promise<UserRoot> {
    const commit = await this.store.get(this.cid, check.assureCommit)
    return this.store.get(commit.root, check.assureUserRoot)
  }

  async createSchemaStore(name: string): Promise<SchemaStore> {
    if (this.schemas[name] !== undefined) {
      throw new Error(`Schema store already exists for schema: ${name}`)
    }
    const schemaStore = await SchemaStore.create(this.store)
    this.schemaCids[name] = schemaStore.cid
    return schemaStore
  }

  async runOnSchema<T>(
    schemaName: string,
    fn: (store: SchemaStore) => Promise<T>,
  ): Promise<T> {
    const cid = this.schemaCids[schemaName]
    const store = cid
      ? await SchemaStore.load(cid, this.store)
      : await this.createSchemaStore(schemaName)
    const res = await fn(store)
    if (store.cid.toString() !== cid.toString()) {
      await this.updateRoot()
    }
    return res
  }

  async loadSchemaStore(name: string): Promise<SchemaStore | null> {
    const cid = this.schemaCids[name]
    if (!cid) return null
    return SchemaStore.load(cid, this.store)
  }

  async put(value: Record<string, unknown>): Promise<CID> {
    return this.store.put(value)
  }

  async get<T>(cid: CID, checkFn: (obj: unknown) => T): Promise<T> {
    return this.store.get(cid, checkFn)
  }

  async writeToCarStream(car: BlockWriter): Promise<void> {
    await this.store.addToCar(car, this.cid)
    const commit = await this.store.get(this.cid, check.assureCommit)
    await this.store.addToCar(car, commit.root)
    await Promise.all(
      Object.values(this.schemaCids).map(async (cid) => {
        const schemaStore = await SchemaStore.load(cid, this.store)
        await schemaStore.writeToCarStream(car)
      }),
    )
  }

  async getCarFile(): Promise<Uint8Array> {
    const { writer, out } = CarWriter.create([this.cid])
    await this.writeToCarStream(writer)
    writer.close()
    return streamToArray(out)
  }
}

export default UserStore
