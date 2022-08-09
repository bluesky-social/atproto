import { CID } from 'multiformats/cid'
import { CarReader, CarWriter } from '@ipld/car'
import { BlockWriter } from '@ipld/car/lib/writer-browser'

import { RepoRoot, Commit, schema, BatchWrite, DataStore } from './types'
import { DID } from '../common/types'
import * as check from '../common/check'
import IpldStore, { AllowedIpldVal } from '../blockstore/ipld-store'
import { streamToArray } from '../common/util'
import * as auth from '@adxp/auth'
import * as service from '../network/service'
import { AuthStore } from '@adxp/auth'
import { MST } from './mst'
import Collection from './collection'

export class Repo {
  blockstore: IpldStore
  data: DataStore
  cid: CID
  did: DID
  authStore: auth.AuthStore | null

  constructor(params: {
    blockstore: IpldStore
    data: DataStore
    cid: CID
    did: DID
    authStore: auth.AuthStore | null
  }) {
    this.blockstore = params.blockstore
    this.data = params.data
    this.cid = params.cid
    this.did = params.did
    this.authStore = params.authStore
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

    const data = await MST.create(blockstore)
    const dataCid = await data.save()

    const rootObj: RepoRoot = {
      did,
      prev: null,
      auth_token: tokenCid,
      data: dataCid,
    }

    const rootCid = await blockstore.put(rootObj)
    const commit: Commit = {
      root: rootCid,
      sig: await authStore.sign(rootCid.bytes),
    }

    const cid = await blockstore.put(commit)

    return new Repo({
      blockstore,
      data,
      cid,
      did,
      authStore,
    })
  }

  static async load(blockstore: IpldStore, cid: CID, authStore?: AuthStore) {
    const commit = await blockstore.get(cid, schema.commit)
    const root = await blockstore.get(commit.root, schema.repoRoot)
    const data = await MST.fromCid(blockstore, root.data)
    return new Repo({
      blockstore,
      data,
      cid,
      did: root.did,
      authStore: authStore || null,
    })
  }

  static async fromCarFile(
    buf: Uint8Array,
    store: IpldStore,
    // emit?: (evt: delta.Event) => Promise<void>,
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
    // await repo.verifySetOfUpdates(null, repo.cid, emit)
    await repo.verifySetOfUpdates(null, repo.cid)
    return repo
  }

  getCollection(name: string): Collection {
    return new Collection(this, name)
  }

  // The repo is mutable & things can change while you perform an operation
  // Ensure that the root of the repo has not changed so that you don't get local branching
  async safeCommit(
    mutation: (data: DataStore) => Promise<DataStore>,
  ): Promise<void> {
    if (this.authStore === null) {
      throw new Error('No keypair provided. Repo is read-only.')
    }
    const currentCommit = this.cid
    const updatedData = await mutation(this.data)
    const tokenCid = await this.ucanForOperation(updatedData)
    const dataCid = await updatedData.save()
    const root: RepoRoot = {
      did: this.did,
      prev: currentCommit,
      auth_token: tokenCid,
      data: dataCid,
    }
    const rootCid = await this.blockstore.put(root)
    const commit: Commit = {
      root: rootCid,
      sig: await this.authStore.sign(rootCid.bytes),
    }
    const commitCid = await this.blockstore.put(commit)
    // If the root of the repo has changed, retry
    if (!this.cid.equals(currentCommit)) {
      return this.safeCommit(mutation)
    }
    this.cid = commitCid
    this.data = updatedData
  }

  async batchWrite(writes: BatchWrite[]) {
    this.safeCommit(async (data: DataStore) => {
      for (const write of writes) {
        // @TODO verify collection & key constraints
        const dataKey = write.collection + '/' + write.key
        let valueCid: CID | undefined
        if (write.value) {
          valueCid = await this.put(write.value)
        }
        if (write.action === 'create') {
          if (!valueCid) {
            throw new Error('No value given for create operation')
          }
          data = await data.add(dataKey, valueCid)
        } else if (write.action === 'update') {
          if (!valueCid) {
            throw new Error('No value given for update operation')
          }
          data = await data.update(dataKey, valueCid)
        } else if (write.action === 'del') {
          data = await data.delete(dataKey)
        } else {
          throw new Error(`Invalid write action: ${write.action}`)
        }
      }
      return data
    })
  }

  // ROOT OPERATIONS
  // -----------
  async getCommit(): Promise<Commit> {
    return this.blockstore.get(this.cid, schema.commit)
  }

  async getRoot(): Promise<RepoRoot> {
    const commit = await this.getCommit()
    return this.blockstore.get(commit.root, schema.repoRoot)
  }

  async loadRoot(newRoot: CID): Promise<void> {
    const commit = await this.blockstore.get(newRoot, schema.commit)
    const root = await this.blockstore.get(commit.root, schema.repoRoot)
    this.data = await MST.fromCid(this.blockstore, root.data)
    this.cid = newRoot
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

  async ucanForOperation(newData: DataStore): Promise<CID> {
    if (!this.authStore) {
      throw new Error('No keypair provided. Repo is read-only.')
    }
    const diff = await this.data.diff(newData)
    const neededCaps = diff.neededCapabilities(this.did)
    const ucanForOp = await this.authStore.createUcanForCaps(
      this.did,
      neededCaps,
      30,
    )
    return this.blockstore.put(auth.encodeUcan(ucanForOp))
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
  async loadAndVerifyDiff(buf: Uint8Array): Promise<void> {
    const root = await this.loadCar(buf)
    await this.verifySetOfUpdates(this.cid, root)
    await this.loadRoot(root)
  }

  async verifySetOfUpdates(
    oldCommit: CID | null,
    recentCommit: CID,
  ): Promise<void> {
    if (recentCommit.equals(oldCommit)) return
    const toRepo = await Repo.load(this.blockstore, recentCommit)
    const root = await toRepo.getRoot()

    // if the root does not have a predecessor (the genesis commit)
    // & we still have not found the commit we're searching for, then bail
    if (!root.prev) {
      if (oldCommit === null) {
        return
      } else {
        throw new Error('Could not find shared history')
      }
    }

    const prevRepo = await Repo.load(this.blockstore, root.prev)

    // verify auth token covers all necessary writes
    const encodedToken = await this.blockstore.get(
      root.auth_token,
      schema.string,
    )
    const token = await auth.validateUcan(encodedToken)
    const diff = await prevRepo.data.diff(this.data)
    const neededCaps = diff.neededCapabilities(this.did)
    for (const cap of neededCaps) {
      console.log('cap: ', cap)
      await auth.verifyAdxUcan(token, this.did, cap)
    }

    // verify signature matches repo root + auth token
    const commit = await toRepo.getCommit()
    const validSig = await auth.verifySignature(
      token.payload.iss,
      commit.root.bytes,
      commit.sig,
    )
    if (!validSig) {
      throw new Error(`Invalid signature on commit: ${toRepo.cid.toString()}`)
    }

    // check next commits
    await this.verifySetOfUpdates(oldCommit, root.prev)
  }

  // async missingCids(): Promise<CidSet> {
  //   const missing = new CidSet()
  //   for (const cid of Object.values(this.namespaceCids)) {
  //     if (await this.blockstore.has(cid)) {
  //       const namespace = await Namespace.load(this.blockstore, cid)
  //       const namespaceMissing = await namespace.missingCids()
  //       missing.addSet(namespaceMissing)
  //     } else {
  //       missing.add(cid)
  //     }
  //   }
  //   return missing
  // }

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
      return this.writeCheckoutToCarStream(car)
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

  async writeCheckoutToCarStream(car: BlockWriter): Promise<void> {
    const commit = await this.blockstore.get(this.cid, schema.commit)
    const root = await this.blockstore.get(commit.root, schema.repoRoot)
    await this.blockstore.addToCar(car, this.cid)
    await this.blockstore.addToCar(car, commit.root)
    await this.blockstore.addToCar(car, root.auth_token)
    await this.data.writeToCarStream(car)
  }

  async writeCommitsToCarStream(
    car: BlockWriter,
    newestCommit: CID,
    oldestCommit: CID | null,
  ): Promise<void> {
    // @TODO write this
    if (newestCommit.equals(oldestCommit)) return
    const commit = await this.blockstore.get(newestCommit, schema.commit)
    const root = await this.blockstore.get(commit.root, schema.repoRoot)

    await this.blockstore.addToCar(car, newestCommit)
    await this.blockstore.addToCar(car, commit.root)
    await this.blockstore.addToCar(car, root.auth_token)

    // if the root does not have a predecessor
    // & we still have not found the commit we're searching for, then bail
    if (!root.prev && oldestCommit !== null) {
      throw new Error(`Could not find commit in repo history: $${oldestCommit}`)
    }
    // if we were supposed to walk from the beginning, then just write the whole genesis
    // data store to the car and we're done
    if (!root.prev) {
      await this.data.writeToCarStream(car)
      return
    }
    // otherwise write the new cids from the last commit and recurse

    const prevCommit = await this.blockstore.get(root.prev, schema.commit)
    const prevRoot = await this.blockstore.get(prevCommit.root, schema.repoRoot)
    const currData = await MST.fromCid(this.blockstore, root.data)
    const prevData = await MST.fromCid(this.blockstore, prevRoot.data)
    const diff = await prevData.diff(currData)
    const newCids = diff.cidsForDiff()
    await Promise.all(newCids.map((cid) => this.blockstore.addToCar(car, cid)))

    await this.writeCommitsToCarStream(car, root.prev, oldestCommit)
  }
}

export default Repo
