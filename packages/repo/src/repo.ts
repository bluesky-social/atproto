import { CID } from 'multiformats/cid'
import { CarReader, CarWriter } from '@ipld/car'
import { BlockWriter } from '@ipld/car/lib/writer-browser'
import { RepoRoot, Commit, def, BatchWrite, DataStore, RepoMeta } from './types'
import { check, streamToArray, TID } from '@atproto/common'
import IpldStore, { AllowedIpldVal } from './blockstore/ipld-store'
import * as auth from '@atproto/auth'
import { DataDiff, MST } from './mst'
import Collection from './collection'
import log from './logger'

export class Repo {
  blockstore: IpldStore
  data: DataStore
  commit: Commit
  root: RepoRoot
  meta: RepoMeta
  cid: CID
  authStore: auth.AuthStore | null
  verifier: auth.Verifier

  constructor(params: {
    blockstore: IpldStore
    data: DataStore
    commit: Commit
    root: RepoRoot
    meta: RepoMeta
    cid: CID
    authStore: auth.AuthStore | undefined
    verifier: auth.Verifier | undefined
  }) {
    this.blockstore = params.blockstore
    this.data = params.data
    this.commit = params.commit
    this.root = params.root
    this.meta = params.meta
    this.cid = params.cid
    this.authStore = params.authStore || null
    this.verifier = params.verifier ?? new auth.Verifier()
  }

  static async create(
    blockstore: IpldStore,
    did: string,
    authStore: auth.AuthStore,
    verifier?: auth.Verifier,
  ): Promise<Repo> {
    let tokenCid: CID | null = null
    if (!(await authStore.canSignForDid(did))) {
      const foundUcan = await authStore.findUcan(auth.maintenanceCap(did))
      if (foundUcan === null) {
        throw new Error(`No valid Ucan for creating repo`)
      }
      tokenCid = await blockstore.put(auth.encodeUcan(foundUcan))
    }

    const data = await MST.create(blockstore)
    const dataCid = await data.save()

    const meta: RepoMeta = {
      did,
      version: 1,
      datastore: 'mst',
    }
    const metaCid = await blockstore.put(meta)

    const root: RepoRoot = {
      meta: metaCid,
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

    log.info({ did }, `created repo`)
    return new Repo({
      blockstore,
      data,
      commit,
      root,
      meta,
      cid,
      authStore,
      verifier,
    })
  }

  static async load(
    blockstore: IpldStore,
    cid: CID,
    verifier?: auth.Verifier,
    authStore?: auth.AuthStore,
  ) {
    const commit = await blockstore.get(cid, def.commit)
    const root = await blockstore.get(commit.root, def.repoRoot)
    const meta = await blockstore.get(root.meta, def.repoMeta)
    const data = await MST.load(blockstore, root.data)
    log.info({ did: meta.did }, 'loaded repo for')
    return new Repo({
      blockstore,
      data,
      commit,
      root,
      meta,
      cid,
      authStore,
      verifier,
    })
  }

  static async fromCarFile(
    buf: Uint8Array,
    blockstore: IpldStore,
    verifier?: auth.Verifier,
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

    const repo = await Repo.load(blockstore, root, verifier, authStore)
    if (verifyAuthority) {
      await repo.verifySetOfUpdates(null, repo.cid)
    }
    return repo
  }

  did(): string {
    return this.meta.did
  }

  getCollection(name: string): Collection {
    if (name.length > 256) {
      throw new Error(
        `Collection names may not be longer than 256 chars: ${name}`,
      )
    }
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
    // if we're signing with the root key, we don't need an auth token
    const tokenCid = (await this.authStore.canSignForDid(this.did()))
      ? null
      : await this.ucanForOperation(updatedData)
    const dataCid = await updatedData.save()
    const root: RepoRoot = {
      meta: this.root.meta,
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

    log.info(
      {
        did: this.did(),
        prev: currentCommit.toString(),
        commit: commitCid.toString(),
      },
      'created commit',
    )
  }

  async batchWrite(writes: BatchWrite[]) {
    await this.safeCommit(async (data: DataStore) => {
      for (const write of writes) {
        if (write.action === 'create') {
          const rkey = write.rkey || TID.nextStr()
          const dataKey = write.collection + '/' + rkey
          const cid = await this.put(write.value)
          data = await data.add(dataKey, cid)
        } else if (write.action === 'update') {
          const cid = await this.put(write.value)
          const dataKey = write.collection + '/' + write.rkey
          data = await data.update(dataKey, cid)
        } else if (write.action === 'delete') {
          const dataKey = write.collection + '/' + write.rkey
          data = await data.delete(dataKey)
        }
      }
      return data
    })
  }

  async revert(count: number): Promise<void> {
    const revertFrom = this.cid
    let revertTo = this.cid
    for (let i = 0; i < count; i++) {
      const commit = await this.blockstore.get(revertTo, def.commit)
      const root = await this.blockstore.get(commit.root, def.repoRoot)
      if (root.prev === null) {
        throw new Error(`Could not revert ${count} commits`)
      }
      revertTo = root.prev
    }
    await this.loadRoot(revertTo)
    log.info(
      {
        did: this.did(),
        from: revertFrom.toString(),
        to: revertTo.toString(),
      },
      'revert repo',
    )
  }

  // ROOT OPERATIONS
  // -----------
  async getCommit(): Promise<Commit> {
    return this.blockstore.get(this.cid, def.commit)
  }

  async getRoot(): Promise<RepoRoot> {
    const commit = await this.getCommit()
    return this.blockstore.get(commit.root, def.repoRoot)
  }

  async loadRoot(newRoot: CID): Promise<void> {
    const commit = await this.blockstore.get(newRoot, def.commit)
    const root = await this.blockstore.get(commit.root, def.repoRoot)
    this.data = await MST.load(this.blockstore, root.data)
    this.cid = newRoot
  }

  // IPLD STORE PASS THROUGHS
  // -----------

  async put(value: AllowedIpldVal): Promise<CID> {
    return this.blockstore.put(value)
  }

  async get<T>(cid: CID, schema: check.Def<T>): Promise<T> {
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
    const fullDiff = new DataDiff()
    if (commitPath.length === 0) return fullDiff
    let prevRepo = await Repo.load(this.blockstore, commitPath[0])
    for (const commit of commitPath.slice(1)) {
      const nextRepo = await Repo.load(this.blockstore, commit)
      const diff = await prevRepo.data.diff(nextRepo.data)

      if (!nextRepo.root.meta.equals(prevRepo.root.meta)) {
        throw new Error('Not supported: repo metadata updated')
      }

      let didForSignature: string
      if (nextRepo.root.auth_token) {
        // verify auth token covers all necessary writes
        const encodedToken = await this.blockstore.get(
          nextRepo.root.auth_token,
          def.string,
        )
        const token = await this.verifier.validateUcan(encodedToken)
        const neededCaps = diff.neededCapabilities(this.did())
        for (const cap of neededCaps) {
          await this.verifier.verifyAtpUcan(token, this.did(), cap)
        }
        didForSignature = token.payload.iss
      } else {
        didForSignature = this.did()
      }

      // verify signature matches repo root + auth token
      // const commit = await toRepo.getCommit()
      const validSig = await this.verifier.verifySignature(
        didForSignature,
        nextRepo.commit.root.bytes,
        nextRepo.commit.sig,
      )
      if (!validSig) {
        throw new Error(
          `Invalid signature on commit: ${nextRepo.cid.toString()}`,
        )
      }

      fullDiff.addDiff(diff)
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
      const commit = await this.blockstore.get(curr, def.commit)
      if (toFind && curr.equals(toFind)) {
        return path.reverse()
      }
      const root = await this.blockstore.get(commit.root, def.repoRoot)
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
    const commit = await this.blockstore.get(this.cid, def.commit)
    const root = await this.blockstore.get(commit.root, def.repoRoot)
    await this.blockstore.addToCar(car, this.cid)
    await this.blockstore.addToCar(car, commit.root)
    await this.blockstore.addToCar(car, root.meta)
    if (root.auth_token) {
      await this.blockstore.addToCar(car, root.auth_token)
    }
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
      await this.blockstore.addToCar(car, nextHead.root.meta)
      if (nextHead.root.auth_token) {
        await this.blockstore.addToCar(car, nextHead.root.auth_token)
      }
      if (prevHead === null) {
        await nextHead.data.writeToCarStream(car)
      } else {
        const diff = await prevHead.data.diff(nextHead.data)
        await Promise.all(
          diff.newCidList().map((cid) => this.blockstore.addToCar(car, cid)),
        )
      }
      prevHead = nextHead
    }
  }
}

export default Repo
