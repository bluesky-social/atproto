import { CID } from 'multiformats/cid'
import { CarReader, CarWriter } from '@ipld/car'
import { BlockWriter } from '@ipld/car/lib/writer-browser'

import { RepoRoot, Commit, schema, BatchWrite, DataStore } from './types'
import * as check from '../common/check'
import IpldStore, { AllowedIpldVal } from '../blockstore/ipld-store'
import { streamToArray } from '../common/util'
import * as auth from '@adxp/auth'
import * as service from '../network/service'
import { AuthStore } from '@adxp/auth'
import { DataDiff, MST } from './mst'
import Collection from './collection'

export class Repo {
  blockstore: IpldStore
  data: DataStore
  commit: Commit
  root: RepoRoot
  cid: CID
  authStore: auth.AuthStore | null

  constructor(params: {
    blockstore: IpldStore
    data: DataStore
    commit: Commit
    root: RepoRoot
    cid: CID
    authStore: auth.AuthStore | null
  }) {
    this.blockstore = params.blockstore
    this.data = params.data
    this.commit = params.commit
    this.root = params.root
    this.cid = params.cid
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

    const root: RepoRoot = {
      did,
      prev: null,
      auth_token: tokenCid,
      data: dataCid,
    }

    const rootCid = await blockstore.put(root)
    const commit: Commit = {
      root: rootCid,
      sig: await authStore.sign(rootCid.bytes),
    }

    const cid = await blockstore.put(commit)

    return new Repo({
      blockstore,
      data,
      commit,
      root,
      cid,
      authStore,
    })
  }

  static async load(blockstore: IpldStore, cid: CID, authStore?: AuthStore) {
    const commit = await blockstore.get(cid, schema.commit)
    const root = await blockstore.get(commit.root, schema.repoRoot)
    const data = await MST.load(blockstore, root.data)
    return new Repo({
      blockstore,
      data,
      commit,
      root,
      cid,
      authStore: authStore || null,
    })
  }

  static async fromCarFile(
    buf: Uint8Array,
    blockstore: IpldStore,
    verifyAuthority = true,
    authStore?: auth.AuthStore,
  ) {
    const car = await CarReader.fromBytes(buf)

    const roots = await car.getRoots()
    if (roots.length !== 1) {
      throw new Error(`Expected one root, got ${roots.length}`)
    }
    const root = roots[0]

    for await (const block of car.blocks()) {
      await blockstore.putBytes(block.cid, block.bytes)
    }

    const repo = await Repo.load(blockstore, root, authStore)
    if (verifyAuthority) {
      await repo.verifySetOfUpdates(null, repo.cid)
    }
    return repo
  }

  did(): string {
    return this.root.did
  }

  getCollection(name: string): Collection {
    if (name.length > 256) {
      throw new Error(
        `Collection names may not be longer than 256 chars: ${name}`,
      )
    }
    const parts = name.split('/')
    if (parts.length > 2) {
      throw new Error(
        `Only one level of namespacing allowed in collection names: ${name}`,
      )
    } else if (parts.length < 2) {
      throw new Error(
        `Expected at least one level of namespacing in collection name: ${name}`,
      )
    }
    return new Collection(this, parts[0], parts[1])
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
      did: this.did(),
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
    this.data = await MST.load(this.blockstore, root.data)
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
    const neededCaps = diff.neededCapabilities(this.did())
    const ucanForOp = await this.authStore.createUcanForCaps(
      this.did(),
      neededCaps,
      30,
    )
    return this.blockstore.put(auth.encodeUcan(ucanForOp))
  }

  async maintenanceToken(forDid: string): Promise<auth.Ucan> {
    if (!this.authStore) {
      throw new Error('No keypair provided. Repo is read-only.')
    }
    return this.authStore.createUcan(forDid, auth.maintenanceCap(this.did()))
  }

  // PUSH/PULL TO REMOTE
  // -----------

  async push(url: string): Promise<void> {
    const remoteRoot = await service.getRemoteRoot(url, this.did())
    if (this.cid.equals(remoteRoot)) {
      // already up to date
      return
    }
    const car = await this.getDiffCar(remoteRoot)
    await service.pushRepo(url, this.did(), car)
  }

  async pull(url: string): Promise<void> {
    const car = await service.pullRepo(url, this.did(), this.cid)
    if (car === null) {
      throw new Error(`Could not find repo for did: ${this.did()}`)
    }
    await this.loadAndVerifyDiff(car)
  }

  // VERIFYING UPDATES
  // -----------

  // loads car files, verifies structure, signature & auth on each commit
  // emits semantic updates to the structure starting from oldest first
  async loadAndVerifyDiff(buf: Uint8Array): Promise<DataDiff> {
    const root = await this.loadCar(buf)
    const diff = await this.verifySetOfUpdates(this.cid, root)
    await this.loadRoot(root)
    return diff
  }

  async verifySetOfUpdates(
    oldCommit: CID | null,
    recentCommit: CID,
  ): Promise<DataDiff> {
    const commitPath = await this.commitPath(oldCommit, recentCommit)
    if (commitPath === null) {
      throw new Error('Could not find shared history')
    }
    let fullDiff = new DataDiff()
    if (commitPath.length === 0) return fullDiff
    let prevRepo = await Repo.load(this.blockstore, commitPath[0])
    for (const commit of commitPath.slice(1)) {
      const nextRepo = await Repo.load(this.blockstore, commit)

      // verify auth token covers all necessary writes
      const encodedToken = await this.blockstore.get(
        nextRepo.root.auth_token,
        schema.string,
      )
      const token = await auth.validateUcan(encodedToken)
      const diff = await prevRepo.data.diff(nextRepo.data)
      const neededCaps = diff.neededCapabilities(this.did())
      for (const cap of neededCaps) {
        await auth.verifyAdxUcan(token, this.did(), cap)
      }

      fullDiff.addDiff(diff)

      // verify signature matches repo root + auth token
      // const commit = await toRepo.getCommit()
      const validSig = await auth.verifySignature(
        token.payload.iss,
        nextRepo.commit.root.bytes,
        nextRepo.commit.sig,
      )
      if (!validSig) {
        throw new Error(
          `Invalid signature on commit: ${nextRepo.cid.toString()}`,
        )
      }
      prevRepo = nextRepo
    }
    return fullDiff
  }

  async commitPath(
    toFind: CID | null, // null to go to genesis commit
    recentCommit = this.cid,
  ): Promise<CID[] | null> {
    let curr: CID | null = recentCommit
    const path: CID[] = []
    while (curr !== null) {
      path.push(curr)
      const commit = await this.blockstore.get(curr, schema.commit)
      if (toFind && curr.equals(toFind)) {
        return path.reverse()
      }
      const root = await this.blockstore.get(commit.root, schema.repoRoot)
      if (!toFind && root.prev === null) {
        return path.reverse()
      }
      curr = root.prev
    }
    return null
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
      return this.writeCheckoutToCarStream(car)
    })
  }

  async getDiffCar(to: CID | null): Promise<Uint8Array> {
    return this.openCar((car: BlockWriter) => {
      return this.writeCommitsToCarStream(car, to, this.cid)
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
    oldestCommit: CID | null,
    recentCommit: CID,
  ): Promise<void> {
    const commitPath = await this.commitPath(oldestCommit, recentCommit)
    if (commitPath === null) {
      throw new Error('Could not find shared history')
    }
    if (commitPath.length === 0) return
    const firstHeadInPath = await Repo.load(this.blockstore, commitPath[0])
    // handle the first commit
    let prevHead: Repo | null =
      firstHeadInPath.root.prev !== null
        ? await Repo.load(this.blockstore, firstHeadInPath.root.prev)
        : null
    for (const commit of commitPath) {
      const nextHead = await Repo.load(this.blockstore, commit)
      await this.blockstore.addToCar(car, nextHead.cid)
      await this.blockstore.addToCar(car, nextHead.commit.root)
      await this.blockstore.addToCar(car, nextHead.root.auth_token)
      if (prevHead === null) {
        await nextHead.data.writeToCarStream(car)
      } else {
        const diff = await prevHead.data.diff(nextHead.data)
        await Promise.all(
          diff.newCids().map((cid) => this.blockstore.addToCar(car, cid)),
        )
      }
      prevHead = nextHead
    }
  }
}

export default Repo
