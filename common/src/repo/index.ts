import { CID } from 'multiformats/cid'
import { CarReader, CarWriter } from '@ipld/car'
import { BlockWriter } from '@ipld/car/lib/writer-browser'

import * as ucan from 'ucans'

import {
  RepoRoot,
  CarStreamable,
  IdMapping,
  Commit,
  schema,
  UpdateData,
} from './types.js'
import { DID, Keypair } from '../common/types.js'
import * as check from '../common/check.js'
import IpldStore from '../blockstore/ipld-store.js'
import { streamToArray } from '../common/util.js'
import Namespace from './namespace.js'
import Relationships from './relationships.js'
import {
  blueskySemantics,
  maintenanceCap,
  writeCap,
} from '../auth/bluesky-capability.js'

export class Repo implements CarStreamable {
  blockstore: IpldStore
  ucanStore: ucan.Store
  namespaceCids: IdMapping
  namespaces: { [name: string]: Namespace }
  relationships: Relationships
  cid: CID
  did: DID
  private keypair: Keypair | null

  constructor(params: {
    blockstore: IpldStore
    ucanStore: ucan.Store
    namespaceCids: IdMapping
    relationships: Relationships
    cid: CID
    did: DID
    keypair?: Keypair
  }) {
    this.blockstore = params.blockstore
    this.ucanStore = params.ucanStore
    this.namespaceCids = params.namespaceCids
    this.namespaces = {}
    this.relationships = params.relationships
    this.cid = params.cid
    this.did = params.did
    this.keypair = params.keypair || null

    this.relationships.onUpdate = this.updateRoot
  }

  static async create(
    blockstore: IpldStore,
    did: string,
    keypair: Keypair,
    ucanStore: ucan.Store,
  ) {
    const foundUcan = await ucanStore.findWithCapability(
      keypair.did(),
      blueskySemantics,
      maintenanceCap(did),
      () => true,
    )
    if (!foundUcan.success) {
      throw new Error(`No valid Ucan for creating repo: ${foundUcan.reason}`)
    }
    const tokenCid = await blockstore.put(foundUcan.ucan.encoded())
    const relationships = await Relationships.create(blockstore)
    const rootObj: RepoRoot = {
      did,
      prev: null,
      new_cids: await relationships.cids(),
      auth_token: tokenCid, // @FIX THIS
      relationships: relationships.cid,
      namespaces: {},
    }

    const rootCid = await blockstore.put(rootObj)
    const commit: Commit = {
      root: rootCid,
      sig: await keypair.sign(rootCid.bytes),
    }

    const cid = await blockstore.put(commit)
    const namespaceCids: IdMapping = {}

    return new Repo({
      blockstore,
      ucanStore,
      namespaceCids,
      relationships,
      cid,
      did,
      keypair,
    })
  }

  static async load(
    blockstore: IpldStore,
    cid: CID,
    keypair?: Keypair,
    ucanStore?: ucan.Store,
  ) {
    const commit = await blockstore.get(cid, schema.commit)
    const root = await blockstore.get(commit.root, schema.repoRoot)
    const relationships = await Relationships.load(
      blockstore,
      root.relationships,
    )
    return new Repo({
      blockstore,
      ucanStore: ucanStore || (await ucan.Store.fromTokens([])),
      namespaceCids: root.namespaces,
      relationships,
      cid,
      did: root.did,
      keypair,
    })
  }

  static async fromCarFile(
    buf: Uint8Array,
    store: IpldStore,
    keypair?: Keypair,
    ucanStore?: ucan.Store,
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

    return Repo.load(store, root, keypair, ucanStore)
  }

  // arrow fn to preserve scope
  updateRootForNamespace =
    (namespaceId: string) =>
    async (update: UpdateData): Promise<void> => {
      const namespace = this.namespaces[namespaceId]
      if (!namespace) {
        throw new Error(
          `Tried to update namespace root for a namespace that doesnt exist: ${namespaceId}`,
        )
      }
      // if a new namespace, make sure we add the structural nodes
      const newCids = update.newCids
      if (this.namespaceCids[namespaceId] === undefined) {
        newCids
          .add(namespace.cid)
          .add(namespace.posts.cid)
          .add(namespace.interactions.cid)
      }
      this.namespaceCids[namespaceId] = namespace.cid
      await this.updateRoot({
        ...update,
        namespace: namespaceId,
        newCids,
      })
    }

  updateRoot = async (update: UpdateData): Promise<void> => {
    if (this.keypair === null) {
      throw new Error('No keypair provided. Repo is read-only.')
    }
    const newCids = update.newCids
    const tokenCid = await this.ucanForOperation(update)
    const root: RepoRoot = {
      did: this.did,
      prev: this.cid,
      new_cids: newCids.toList(),
      auth_token: tokenCid,
      namespaces: this.namespaceCids,
      relationships: this.relationships.cid,
    }
    const rootCid = await this.blockstore.put(root)
    newCids.add(rootCid)
    const commit: Commit = {
      root: rootCid,
      sig: await this.keypair.sign(rootCid.bytes),
    }
    this.cid = await this.blockstore.put(commit)
  }

  async getCommit(): Promise<Commit> {
    return this.blockstore.get(this.cid, schema.commit)
  }

  async getRoot(): Promise<RepoRoot> {
    const commit = await this.getCommit()
    return this.blockstore.get(commit.root, schema.repoRoot)
  }

  // Namespace API
  // -----------

  async createNamespace(id: string): Promise<Namespace> {
    if (this.namespaceCids[id] !== undefined) {
      throw new Error(`Namespace already exists for id: ${id}`)
    }
    const namespace = await Namespace.create(this.blockstore)
    namespace.onUpdate = this.updateRootForNamespace(id)
    this.namespaces[id] = namespace
    return namespace
  }

  async loadOrCreateNamespace(id: string): Promise<Namespace> {
    if (this.namespaces[id]) {
      return this.namespaces[id]
    }
    const cid = this.namespaceCids[id]
    if (!cid) {
      return this.createNamespace(id)
    }
    const namespace = await Namespace.load(this.blockstore, cid)
    namespace.onUpdate = this.updateRootForNamespace(id)
    this.namespaces[id] = namespace
    return namespace
  }

  async runOnNamespace<T>(
    id: string,
    fn: (store: Namespace) => Promise<T>,
  ): Promise<T> {
    const namespace = await this.loadOrCreateNamespace(id)
    return fn(namespace)
  }

  // IPLD store methods
  // -----------

  async put(value: Record<string, unknown> | string): Promise<CID> {
    return this.blockstore.put(value)
  }

  async get<T>(cid: CID, schema: check.Schema<T>): Promise<T> {
    return this.blockstore.get(cid, schema)
  }

  // UCAN Auth
  // -----------

  async ucanForOperation(update: UpdateData): Promise<CID> {
    if (!this.keypair) {
      throw new Error('No keypair provided. Repo is read-only.')
    }
    const neededCap = writeCap(
      this.did,
      update.namespace,
      update.collection,
      update.tid,
    )
    const foundUcan = this.ucanStore.findWithCapability(
      this.keypair.did(),
      blueskySemantics,
      neededCap,
      () => true,
    )
    if (!foundUcan.success) {
      throw new Error(
        `Could not find a valid ucan for operation: ${neededCap.bluesky}`,
      )
    }
    return this.blockstore.put(foundUcan.ucan.encoded())
  }

  // CAR files
  // -----------

  async loadCar(buf: Uint8Array): Promise<void> {
    const car = await CarReader.fromBytes(buf)
    const roots = await car.getRoots()
    if (roots.length !== 1) {
      throw new Error(`Expected one root, got ${roots.length}`)
    }
    const rootCid = roots[0]
    for await (const block of car.blocks()) {
      await this.blockstore.putBytes(block.cid, block.bytes)
    }
    this.cid = rootCid
    const root = await this.getRoot()
    this.did = root.did
    this.namespaceCids = root.namespaces
    this.namespaces = {}
    this.relationships = await Relationships.load(
      this.blockstore,
      root.relationships,
    )
  }

  async getCarNoHistory(): Promise<Uint8Array> {
    return this.openCar((car: BlockWriter) => {
      return this.writeToCarStream(car)
    })
  }

  async getDiffCar(to: CID | null): Promise<Uint8Array> {
    return this.openCar((car: BlockWriter) => {
      return this.writeCommitsToCarStream(car, this.cid, to)
    })
  }

  async getFullHistory(): Promise<Uint8Array> {
    return this.getDiffCar(null)
  }

  private async openCar(
    fn: (car: BlockWriter) => Promise<void>,
  ): Promise<Uint8Array> {
    const { writer, out } = CarWriter.create([this.cid])
    await fn(writer)
    writer.close()
    return streamToArray(out)
  }

  async writeToCarStream(car: BlockWriter): Promise<void> {
    await this.blockstore.addToCar(car, this.cid)
    const commit = await this.blockstore.get(this.cid, schema.commit)
    await this.blockstore.addToCar(car, commit.root)
    await this.relationships.writeToCarStream(car)
    await Promise.all(
      Object.values(this.namespaceCids).map(async (cid) => {
        const namespace = await Namespace.load(this.blockstore, cid)
        await namespace.writeToCarStream(car)
      }),
    )
  }

  async writeCommitsToCarStream(
    car: BlockWriter,
    from: CID,
    to: CID | null,
  ): Promise<void> {
    const commit = await this.blockstore.get(from, schema.commit)
    const { new_cids, prev } = await this.blockstore.get(
      commit.root,
      schema.repoRoot,
    )
    await this.blockstore.addToCar(car, this.cid)
    await this.blockstore.addToCar(car, commit.root)

    await Promise.all(new_cids.map((cid) => this.blockstore.addToCar(car, cid)))
    if (!prev) {
      if (to === null) {
        return
      }
      throw new Error(`Count not find commit: $${to}`)
    }
    if (prev.toString() === to?.toString()) {
      return
    }
    await this.writeCommitsToCarStream(car, prev, to)
  }
}

export default Repo
