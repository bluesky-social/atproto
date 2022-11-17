import { CID } from 'multiformats/cid'
import { CarWriter } from '@ipld/car'
import { BlockWriter } from '@ipld/car/lib/writer-browser'
import {
  RepoRoot,
  Commit,
  def,
  DataStore,
  RepoMeta,
  RecordCreateOp,
  RecordWriteOp,
} from './types'
import { streamToArray } from '@atproto/common'
import IpldStore from './blockstore/ipld-store'
import * as auth from '@atproto/auth'
import { MST } from './mst'
import log from './logger'
import * as util from './util'

type Params = {
  blockstore: IpldStore
  data: DataStore
  commit: Commit
  root: RepoRoot
  meta: RepoMeta
  cid: CID
  stagedWrites: RecordWriteOp[]
}

export class Repo {
  blockstore: IpldStore
  data: DataStore
  commit: Commit
  root: RepoRoot
  meta: RepoMeta
  cid: CID
  stagedWrites: RecordWriteOp[]

  constructor(params: Params) {
    this.blockstore = params.blockstore
    this.data = params.data
    this.commit = params.commit
    this.root = params.root
    this.meta = params.meta
    this.cid = params.cid
    this.stagedWrites = params.stagedWrites
  }

  static async create(
    blockstore: IpldStore,
    did: string,
    authStore: auth.AuthStore,
    initialRecords: RecordCreateOp[] = [],
  ): Promise<Repo> {
    let tokenCid: CID | null = null
    if (!(await authStore.canSignForDid(did))) {
      const foundUcan = await authStore.findUcan(auth.maintenanceCap(did))
      if (foundUcan === null) {
        throw new Error(`No valid Ucan for creating repo`)
      }
      tokenCid = await blockstore.stage(auth.encodeUcan(foundUcan))
    }

    let data = await MST.create(blockstore)
    for (const write of initialRecords) {
      const cid = await blockstore.stage(write.value)
      const dataKey = write.collection + '/' + write.rkey
      data = await data.add(dataKey, cid)
    }
    const dataCid = await data.stage()

    const meta: RepoMeta = {
      did,
      version: 1,
      datastore: 'mst',
    }
    const metaCid = await blockstore.stage(meta)

    const root: RepoRoot = {
      meta: metaCid,
      prev: null,
      auth_token: tokenCid,
      data: dataCid,
    }

    const rootCid = await blockstore.stage(root)
    const commit: Commit = {
      root: rootCid,
      sig: await authStore.sign(rootCid.bytes),
    }

    const cid = await blockstore.stage(commit)

    await blockstore.saveStaged()

    log.info({ did }, `created repo`)
    return new Repo({
      blockstore,
      data,
      commit,
      root,
      meta,
      cid,
      stagedWrites: [],
    })
  }

  static async load(blockstore: IpldStore, cid: CID) {
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
      stagedWrites: [],
    })
  }

  private updateRepo(params: Partial<Params>): Repo {
    return new Repo({
      blockstore: params.blockstore || this.blockstore,
      data: params.data || this.data,
      commit: params.commit || this.commit,
      root: params.root || this.root,
      meta: params.meta || this.meta,
      cid: params.cid || this.cid,
      stagedWrites: params.stagedWrites || this.stagedWrites,
    })
  }

  get did(): string {
    return this.meta.did
  }

  async getRecord(collection: string, rkey: string): Promise<unknown | null> {
    const dataKey = collection + '/' + rkey
    const cid = await this.data.get(dataKey)
    if (!cid) return null
    return this.blockstore.getUnchecked(cid)
  }

  stageUpdate(write: RecordWriteOp | RecordWriteOp[]): Repo {
    const writeArr = Array.isArray(write) ? write : [write]
    return this.updateRepo({
      stagedWrites: [...this.stagedWrites, ...writeArr],
    })
  }

  async createCommit(
    authStore: auth.AuthStore,
    performUpdate?: (prev: CID, curr: CID) => Promise<CID | null>,
  ): Promise<Repo> {
    let data = this.data
    for (const write of this.stagedWrites) {
      if (write.action === 'create') {
        const cid = await this.blockstore.stage(write.value)
        const dataKey = write.collection + '/' + write.rkey
        data = await data.add(dataKey, cid)
      } else if (write.action === 'update') {
        const cid = await this.blockstore.stage(write.value)
        const dataKey = write.collection + '/' + write.rkey
        data = await data.update(dataKey, cid)
      } else if (write.action === 'delete') {
        const dataKey = write.collection + '/' + write.rkey
        data = await data.delete(dataKey)
      }
    }
    const token = (await authStore.canSignForDid(this.did))
      ? null
      : await util.ucanForOperation(this.data, data, this.did, authStore)
    const tokenCid = token ? await this.blockstore.stage(token) : null

    const dataCid = await data.stage()
    const root: RepoRoot = {
      meta: this.root.meta,
      prev: this.cid,
      auth_token: tokenCid,
      data: dataCid,
    }
    const rootCid = await this.blockstore.stage(root)
    const commit: Commit = {
      root: rootCid,
      sig: await authStore.sign(rootCid.bytes),
    }
    const commitCid = await this.blockstore.stage(commit)

    if (performUpdate) {
      const rebaseOn = await performUpdate(this.cid, commitCid)
      if (rebaseOn) {
        await this.blockstore.clearStaged()
        const rebaseRepo = await Repo.load(this.blockstore, rebaseOn)
        return rebaseRepo.createCommit(authStore, performUpdate)
      } else {
        await this.blockstore.saveStaged()
      }
    } else {
      await this.blockstore.saveStaged()
    }

    return this.updateRepo({
      cid: commitCid,
      root,
      commit,
      data,
      stagedWrites: [],
    })
  }

  async revert(count: number): Promise<Repo> {
    let revertTo = this.cid
    for (let i = 0; i < count; i++) {
      const commit = await this.blockstore.get(revertTo, def.commit)
      const root = await this.blockstore.get(commit.root, def.repoRoot)
      if (root.prev === null) {
        throw new Error(`Could not revert ${count} commits`)
      }
      revertTo = root.prev
    }
    return Repo.load(this.blockstore, revertTo)
  }

  // CAR FILES
  // -----------

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
    try {
      await fn(writer)
    } finally {
      writer.close()
    }
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
