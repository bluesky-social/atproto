import { CID } from 'multiformats/cid'
import { CarReader } from '@ipld/car'
import { BlockWriter } from '@ipld/car/lib/writer-browser'
import {
  RepoRoot,
  Commit,
  CidWriteOp,
  DataStore,
  RepoMeta,
  RecordWriteOp,
} from './types'
import IpldStore from './blockstore/ipld-store'
import * as auth from '@atproto/auth'
import { DataDiff } from './mst'
import Collection from './collection'
import * as verify from './verify'
import log from './logger'
import RepoStructure from './structure'

export class Repo {
  blockstore: IpldStore
  structure: RepoStructure
  authStore: auth.AuthStore | null
  verifier: auth.Verifier

  constructor(params: {
    blockstore: IpldStore
    structure: RepoStructure
    authStore: auth.AuthStore | undefined
    verifier: auth.Verifier | undefined
  }) {
    this.blockstore = params.blockstore
    this.structure = params.structure
    this.authStore = params.authStore || null
    this.verifier = params.verifier ?? new auth.Verifier()
  }

  static async create(
    blockstore: IpldStore,
    did: string,
    authStore: auth.AuthStore,
    verifier?: auth.Verifier,
  ): Promise<Repo> {
    const structure = await RepoStructure.create(blockstore, did, authStore)

    log.info({ did }, `created repo`)
    return new Repo({
      blockstore,
      structure,
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
    const structure = await RepoStructure.load(blockstore, cid)
    log.info({ did: structure.meta.did }, 'loaded repo for')
    return new Repo({
      blockstore,
      structure,
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
    if (verifyAuthority && verifier) {
      await verify.verifyUpdates(blockstore, null, repo.cid, verifier)
    }
    return repo
  }

  get did(): string {
    return this.meta.did
  }

  get data(): DataStore {
    return this.structure.data
  }

  get commit(): Commit {
    return this.structure.commit
  }

  get root(): RepoRoot {
    return this.structure.root
  }

  get meta(): RepoMeta {
    return this.structure.meta
  }

  get cid(): CID {
    return this.structure.cid
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
  async safeCommit(write: CidWriteOp | CidWriteOp[]) {
    if (!this.authStore) {
      throw new Error('No provided AuthStore')
    }
    const staged = await this.structure.stageUpdate(write)
    this.structure = await staged.createCommit(this.authStore, async (prev) => {
      if (!this.cid.equals(prev)) return this.cid
      return null
    })
  }

  async batchWrite(writes: RecordWriteOp[]) {
    if (!this.authStore) {
      throw new Error('No provided AuthStore')
    }
    const cidOps = await Promise.all(
      writes.map(async (write) => {
        if (write.action === 'create' || write.action === 'update') {
          return {
            action: write.action,
            collection: write.collection,
            rkey: write.rkey,
            cid: await this.blockstore.put(write.value),
          }
        } else {
          return write
        }
      }),
    )
    await this.safeCommit(cidOps)
  }

  async revert(count: number): Promise<void> {
    const revertFrom = this.structure.cid
    this.structure = await this.structure.revert(count)
    log.info(
      {
        did: this.did,
        from: revertFrom.toString(),
        to: this.structure.cid.toString(),
      },
      'revert repo',
    )
  }

  // ROOT OPERATIONS
  // -----------
  async loadRoot(newRoot: CID): Promise<void> {
    this.structure = await RepoStructure.load(this.blockstore, newRoot)
  }

  // VERIFYING UPDATES
  // -----------

  async verifyUpdates(earliest: CID | null, latest: CID): Promise<DataDiff> {
    return verify.verifyUpdates(
      this.blockstore,
      earliest,
      latest,
      this.verifier,
    )
  }

  // loads car files, verifies structure, signature & auth on each commit
  // emits semantic updates to the structure starting from oldest first
  async loadAndVerifyDiff(buf: Uint8Array): Promise<DataDiff> {
    const root = await this.blockstore.loadCar(buf)
    const diff = await this.verifyUpdates(this.cid, root)
    await this.loadRoot(root)
    return diff
  }

  // CAR FILES
  // -----------

  async loadCarRoot(buf: Uint8Array): Promise<void> {
    const root = await this.blockstore.loadCar(buf)
    await this.loadRoot(root)
  }

  async getCarNoHistory(): Promise<Uint8Array> {
    return this.structure.getCarNoHistory()
  }

  async getDiffCar(to: CID | null): Promise<Uint8Array> {
    return this.structure.getDiffCar(to)
  }

  async getFullHistory(): Promise<Uint8Array> {
    return this.structure.getFullHistory()
  }

  async writeCheckoutToCarStream(car: BlockWriter): Promise<void> {
    return this.structure.writeCheckoutToCarStream(car)
  }

  async writeCommitsToCarStream(
    car: BlockWriter,
    oldestCommit: CID | null,
    recentCommit: CID,
  ): Promise<void> {
    return this.structure.writeCommitsToCarStream(
      car,
      oldestCommit,
      recentCommit,
    )
  }
}

export default Repo
