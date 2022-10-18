import { CID } from 'multiformats/cid'
import { CarReader, CarWriter } from '@ipld/car'
import { BlockWriter } from '@ipld/car/lib/writer-browser'
import { RepoRoot, Commit, def, BatchWrite, DataStore, RepoMeta } from './types'
import { streamToArray } from '@atproto/common'
import IpldStore from './blockstore/ipld-store'
import * as auth from '@atproto/auth'
import { DataDiff } from './mst'
import Collection from './collection'
import * as verify from './verify'
import * as util from './util'
import log from './logger'
import ImmutableRepo from './immutable'

export class Repo {
  blockstore: IpldStore
  _repo: ImmutableRepo
  authStore: auth.AuthStore | null
  verifier: auth.Verifier

  constructor(params: {
    blockstore: IpldStore
    repo: ImmutableRepo
    authStore: auth.AuthStore | undefined
    verifier: auth.Verifier | undefined
  }) {
    this.blockstore = params.blockstore
    this._repo = params.repo
    this.authStore = params.authStore || null
    this.verifier = params.verifier ?? new auth.Verifier()
  }

  static async create(
    blockstore: IpldStore,
    did: string,
    authStore: auth.AuthStore,
    verifier?: auth.Verifier,
  ): Promise<Repo> {
    const repo = await ImmutableRepo.create(blockstore, did, authStore)

    log.info({ did }, `created repo`)
    return new Repo({
      blockstore,
      repo,
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
    const repo = await ImmutableRepo.load(blockstore, cid)
    log.info({ did: repo.meta.did }, 'loaded repo for')
    return new Repo({
      blockstore,
      repo,
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
      await verify.verifySetOfUpdates(blockstore, null, repo.cid, verifier)
    }
    return repo
  }

  get did(): string {
    return this.meta.did
  }

  get data(): DataStore {
    return this._repo.data
  }

  get commit(): Commit {
    return this._repo.commit
  }

  get root(): RepoRoot {
    return this._repo.root
  }

  get meta(): RepoMeta {
    return this._repo.meta
  }

  get cid(): CID {
    return this._repo.cid
  }

  getCollection(name: string): Collection {
    if (name.length > 256) {
      throw new Error(
        `Collection names may not be longer than 256 chars: ${name}`,
      )
    }
    return new Collection(this, name)
  }

  // // The repo is mutable & things can change while you perform an operation
  // // Ensure that the root of the repo has not changed so that you don't get local branching
  // async safeCommit(
  //   mutation: (data: DataStore) => Promise<DataStore>,
  // ): Promise<void> {
  //   if (this.authStore === null) {
  //     throw new Error('No keypair provided. Repo is read-only.')
  //   }
  //   const currentCommit = this.cid
  //   const updatedData = await mutation(this.data)
  //   // if we're signing with the root key, we don't need an auth token
  //   const tokenCid = (await this.authStore.canSignForDid(this.did()))
  //     ? null
  //     : await this.ucanForOperation(updatedData)
  //   const dataCid = await updatedData.save()
  //   const root: RepoRoot = {
  //     meta: this.root.meta,
  //     prev: currentCommit,
  //     auth_token: tokenCid,
  //     data: dataCid,
  //   }
  //   const rootCid = await this.blockstore.put(root)
  //   const commit: Commit = {
  //     root: rootCid,
  //     sig: await this.authStore.sign(rootCid.bytes),
  //   }
  //   const commitCid = await this.blockstore.put(commit)
  //   // If the root of the repo has changed, retry
  //   if (!this.cid.equals(currentCommit)) {
  //     return this.safeCommit(mutation)
  //   }
  //   this.cid = commitCid
  //   this.data = updatedData

  //   log.info(
  //     {
  //       did: this.did(),
  //       prev: currentCommit.toString(),
  //       commit: commitCid.toString(),
  //     },
  //     'created commit',
  //   )
  // }

  async batchWrite(writes: BatchWrite[]) {
    if (!this.authStore) {
      throw new Error('No provided AuthStore')
    }
    const staged = await this._repo.stageUpdate(writes)
    this._repo = await staged.createCommit(this.authStore, async (old) => {
      if (!this.cid.equals(old)) return true
      return false
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
        did: this.did,
        from: revertFrom.toString(),
        to: revertTo.toString(),
      },
      'revert repo',
    )
  }

  // ROOT OPERATIONS
  // -----------
  async loadRoot(newRoot: CID): Promise<void> {
    this._repo = await ImmutableRepo.load(this.blockstore, newRoot)
  }

  // VERIFYING UPDATES
  // -----------

  // loads car files, verifies structure, signature & auth on each commit
  // emits semantic updates to the structure starting from oldest first
  async loadAndVerifyDiff(buf: Uint8Array): Promise<DataDiff> {
    const root = await this.loadCar(buf)
    const diff = await verify.verifySetOfUpdates(
      this.blockstore,
      this.cid,
      root,
      this.verifier,
    )
    await this.loadRoot(root)
    return diff
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
    const commitPath = await util.getCommitPath(
      this.blockstore,
      oldestCommit,
      recentCommit,
    )
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
