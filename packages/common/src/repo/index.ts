import { CID } from 'multiformats/cid'
import { CarReader, CarWriter } from '@ipld/car'
import { BlockWriter } from '@ipld/car/lib/writer-browser'

import {
  RepoRoot,
  CarStreamable,
  IdMapping,
  Commit,
  schema,
  UpdateData,
} from './types'
import { DID } from '../common/types'
import * as check from '../common/check'
import IpldStore, { AllowedIpldVal } from '../blockstore/ipld-store'
import { streamToArray } from '../common/util'
import Namespace from './namespace'
import Relationships from './relationships'
import CidSet from './cid-set'
import * as auth from '@adxp/auth'
import * as service from '../network/service'
import * as delta from './delta'
import { AuthStore } from '@adxp/auth'

export class Repo implements CarStreamable {
  blockstore: IpldStore
  namespaceCids: IdMapping
  namespaces: { [name: string]: Namespace }
  relationships: Relationships
  cid: CID
  did: DID
  authStore: auth.AuthStore | null

  constructor(params: {
    blockstore: IpldStore
    namespaceCids: IdMapping
    relationships: Relationships
    cid: CID
    did: DID
    authStore: auth.AuthStore | null
  }) {
    this.blockstore = params.blockstore
    this.namespaceCids = params.namespaceCids
    this.namespaces = {}
    this.relationships = params.relationships
    this.cid = params.cid
    this.did = params.did
    this.authStore = params.authStore

    this.relationships.onUpdate = this.updateRoot
  }

  static async create(
    blockstore: IpldStore,
    did: string,
    authStore: auth.AuthStore,
  ): Promise<Repo> {
    const foundUcan = await authStore.findUcan(auth.maintenanceCap(did))
    if (foundUcan === null) {
      throw new Error(`No valid Ucan for creating repo`)
    }
    const tokenCid = await blockstore.put(auth.encodeUcan(foundUcan))
    const relationships = await Relationships.create(blockstore)
    const newCids = [...(await relationships.cids()), tokenCid]
    const rootObj: RepoRoot = {
      did,
      prev: null,
      new_cids: newCids,
      auth_token: tokenCid,
      relationships: relationships.cid,
      namespaces: {},
    }

    const rootCid = await blockstore.put(rootObj)
    const commit: Commit = {
      root: rootCid,
      sig: await authStore.sign(rootCid.bytes),
    }

    const cid = await blockstore.put(commit)
    const namespaceCids: IdMapping = {}

    return new Repo({
      blockstore,
      namespaceCids,
      relationships,
      cid,
      did,
      authStore,
    })
  }

  static async load(blockstore: IpldStore, cid: CID, authStore?: AuthStore) {
    const commit = await blockstore.get(cid, schema.commit)
    const root = await blockstore.get(commit.root, schema.repoRoot)
    const relationships = await Relationships.load(
      blockstore,
      root.relationships,
    )
    return new Repo({
      blockstore,
      namespaceCids: root.namespaces,
      relationships,
      cid,
      did: root.did,
      authStore: authStore || null,
    })
  }

  static async fromCarFile(
    buf: Uint8Array,
    store: IpldStore,
    emit?: (evt: delta.Event) => Promise<void>,
    authStore?: auth.AuthStore,
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

    const repo = await Repo.load(store, root, authStore)
    await repo.verifySetOfUpdates(null, repo.cid, emit)
    return repo
  }

  // ROOT OPERATIONS
  // -----------

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
    if (this.authStore === null) {
      throw new Error('No keypair provided. Repo is read-only.')
    }
    const newCids = update.newCids
    const tokenCid = await this.ucanForOperation(update)
    newCids.add(tokenCid)
    const root: RepoRoot = {
      did: this.did,
      prev: this.cid,
      new_cids: newCids.toList(),
      auth_token: tokenCid,
      namespaces: this.namespaceCids,
      relationships: this.relationships.cid,
    }
    const rootCid = await this.blockstore.put(root)
    const commit: Commit = {
      root: rootCid,
      sig: await this.authStore.sign(rootCid.bytes),
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

  async loadRoot(cid: CID): Promise<void> {
    this.cid = cid
    const root = await this.getRoot()
    this.did = root.did
    this.namespaceCids = root.namespaces
    this.namespaces = {}
    this.relationships = await Relationships.load(
      this.blockstore,
      root.relationships,
    )
  }

  // NAMESPACE API
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

  // IPLD STORE PASS THROUGHS
  // -----------

  async put(value: AllowedIpldVal): Promise<CID> {
    return this.blockstore.put(value)
  }

  async get<T>(cid: CID, schema: check.Schema<T>): Promise<T> {
    return this.blockstore.get(cid, schema)
  }

  // UCAN AUTH
  // -----------

  async ucanForOperation(update: UpdateData): Promise<CID> {
    if (!this.authStore) {
      throw new Error('No keypair provided. Repo is read-only.')
    }
    const neededCap = auth.writeCap(
      this.did,
      update.namespace,
      update.collection,
      update.tid?.toString(),
    )
    const foundUcan = await this.authStore.findUcan(neededCap)
    if (foundUcan === null) {
      throw new Error(
        `Could not find a valid ucan for operation: ${neededCap.can.toString()}`,
      )
    }
    return this.blockstore.put(auth.encodeUcan(foundUcan))
  }

  async maintenanceToken(forDid: string): Promise<auth.Ucan> {
    if (!this.authStore) {
      throw new Error('No keypair provided. Repo is read-only.')
    }
    return this.authStore.createUcan(forDid, auth.maintenanceCap(this.did))
  }

  // PUSH/PULL TO REMOTE
  // -----------

  async push(url: string): Promise<void> {
    const remoteRoot = await service.getRemoteRoot(url, this.did)
    if (this.cid.equals(remoteRoot)) {
      // already up to date
      return
    }
    const car = await this.getDiffCar(remoteRoot)
    await service.pushRepo(url, this.did, car)
  }

  async pull(url: string): Promise<void> {
    const car = await service.pullRepo(url, this.did, this.cid)
    if (car === null) {
      throw new Error(`Could not find repo for did: ${this.did}`)
    }
    await this.loadAndVerifyDiff(car)
  }

  // VERIFYING UPDATES
  // -----------

  // loads car files, verifies structure, signature & auth on each commit
  // emits semantic updates to the structure starting from oldest first
  async loadAndVerifyDiff(
    buf: Uint8Array,
    emit?: (evt: delta.Event) => Promise<void>,
  ): Promise<void> {
    const root = await this.loadCar(buf)
    await this.verifySetOfUpdates(this.cid, root, emit)
    await this.loadRoot(root)
  }

  async verifySetOfUpdates(
    from: CID | null,
    to: CID,
    emit?: (evt: delta.Event) => Promise<void>,
  ): Promise<void> {
    if (to.equals(from)) return
    const toRepo = await Repo.load(this.blockstore, to)
    const root = await toRepo.getRoot()
    if (!root.prev) {
      if (from === null) {
        return
      } else {
        throw new Error('Could not find start repo root')
      }
    }
    await this.verifySetOfUpdates(from, root.prev, emit)
    const prevRepo = await Repo.load(this.blockstore, root.prev)
    const updates = await toRepo.verifyUpdate(prevRepo)

    // verify sig & auth
    const encodedToken = await this.blockstore.get(
      root.auth_token,
      schema.string,
    )
    const token = await auth.validateUcan(encodedToken)
    const commit = await toRepo.getCommit()
    const validSig = await auth.verifySignature(
      token.payload.aud,
      commit.root.bytes,
      commit.sig,
    )
    if (!validSig) {
      throw new Error(`Invalid signature on commit: ${toRepo.cid.toString()}`)
    }
    for (const update of updates) {
      const neededCap = delta.capabilityForEvent(root.did, update)
      try {
        await auth.verifyAdxUcan(token, token.payload.aud, neededCap)
      } catch (err) {
        console.log('TOKEN: ', token)
        console.log('NEEDED CAP: ', neededCap)
        console.log('ATT: ', token.payload.att)
        console.log('CAN: ', token.payload.att[0].can)
        throw err
      }
      if (emit) {
        await emit(update)
      }
    }
  }

  async verifyUpdate(prev: Repo): Promise<delta.Event[]> {
    const root = await this.getRoot()
    if (!root.prev) {
      throw new Error('No previous version found at root')
    } else if (!root.prev.equals(prev.cid)) {
      throw new Error('Previous version root CID does not match')
    }
    if (root.did !== prev.did) {
      throw new Error('Changes in DID are not allowed at this point')
    }
    const newCids = new CidSet(root.new_cids)
    let events: delta.Event[] = []
    const mapDiff = delta.idMapDiff(
      prev.namespaceCids,
      this.namespaceCids,
      newCids,
    )
    // namespace deletes: we can emit as events
    for (const del of mapDiff.deletes) {
      events.push(delta.deletedNamespace(del.key))
    }
    // namespace adds: we walk to ensure we have all content & then emit all posts & interactions
    for (const add of mapDiff.adds) {
      const namespace = await Namespace.load(this.blockstore, add.cid)
      const missing = await namespace.missingCids()
      if (missing.size() > 0) {
        throw new Error(
          `Missing cids for namespace ${add.key}: ${missing.toList()}`,
        )
      }
      const [newPosts, newInters] = await Promise.all([
        namespace.posts.getAllEntries(),
        namespace.interactions.getAllEntries(),
      ])
      for (const { cid, tid } of newPosts) {
        events.push(delta.addedObject(add.key, 'posts', tid, cid))
      }
      for (const { cid, tid } of newInters) {
        events.push(delta.addedObject(add.key, 'interactions', tid, cid))
      }
    }
    // namespace updates: we dive deeper to figure out the differences
    for (const update of mapDiff.updates) {
      const [old, curr] = await Promise.all([
        Namespace.load(this.blockstore, update.old),
        Namespace.load(this.blockstore, update.cid),
      ])
      const updates = await curr.verifyUpdate(old, newCids, update.key)
      events = events.concat(updates)
    }
    // relationship updates: we dive deeper to figure out the difference
    if (this.relationships.cid !== prev.relationships.cid) {
      const updates = await this.relationships.verifyUpdate(
        prev.relationships,
        newCids,
      )
      events = events.concat(updates)
    }
    return events
  }

  async missingCids(): Promise<CidSet> {
    const missing = new CidSet()
    for (const cid of Object.values(this.namespaceCids)) {
      if (await this.blockstore.has(cid)) {
        const namespace = await Namespace.load(this.blockstore, cid)
        const namespaceMissing = await namespace.missingCids()
        missing.addSet(namespaceMissing)
      } else {
        missing.add(cid)
      }
    }
    return missing
  }

  // CAR FILES
  // -----------

  async loadCar(buf: Uint8Array): Promise<CID> {
    const car = await CarReader.fromBytes(buf)
    const roots = await car.getRoots()
    if (roots.length !== 1) {
      throw new Error(`Expected one root, got ${roots.length}`)
    }
    const rootCid = roots[0]
    for await (const block of car.blocks()) {
      await this.blockstore.putBytes(block.cid, block.bytes)
    }
    return rootCid
  }

  async loadCarRoot(buf: Uint8Array): Promise<void> {
    const root = await this.loadCar(buf)
    await this.loadRoot(root)
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
    newestCommit: CID,
    oldestCommit: CID | null,
  ): Promise<void> {
    if (oldestCommit && oldestCommit.equals(newestCommit)) return
    const commit = await this.blockstore.get(newestCommit, schema.commit)
    const { new_cids, prev } = await this.blockstore.get(
      commit.root,
      schema.repoRoot,
    )
    await this.blockstore.addToCar(car, newestCommit)
    await this.blockstore.addToCar(car, commit.root)

    await Promise.all(new_cids.map((cid) => this.blockstore.addToCar(car, cid)))
    if (!prev) {
      if (oldestCommit === null) {
        return
      }
      throw new Error(`Could not find commit in repo history: $${oldestCommit}`)
    }
    await this.writeCommitsToCarStream(car, prev, oldestCommit)
  }
}

export default Repo
