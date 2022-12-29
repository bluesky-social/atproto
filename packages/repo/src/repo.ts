import { CID } from 'multiformats/cid'
import { CarWriter } from '@ipld/car'
import { BlockWriter } from '@ipld/car/writer'
import {
  RepoRoot,
  Commit,
  def,
  DataStore,
  RepoMeta,
  RecordCreateOp,
  RecordWriteOp,
  CommitData,
  WriteOpAction,
} from './types'
import { RepoStorage, verifyObj } from './storage'
import * as crypto from '@atproto/crypto'
import { MST } from './mst'
import log from './logger'
import BlockMap from './block-map'
import { ReadableRepo } from './readable-repo'
import { streamToArray } from '@atproto/common'

type Params = {
  storage: RepoStorage
  data: DataStore
  commit: Commit
  root: RepoRoot
  meta: RepoMeta
  cid: CID
}

export class Repo extends ReadableRepo {
  storage: RepoStorage

  constructor(params: Params) {
    super(params)
  }

  static async formatInitCommit(
    storage: RepoStorage,
    did: string,
    keypair: crypto.Keypair,
    initialRecords: RecordCreateOp[] = [],
  ): Promise<CommitData> {
    const newBlocks = new BlockMap()

    let data = await MST.create(storage)
    for (const write of initialRecords) {
      const cid = await newBlocks.add(write.value)
      const dataKey = write.collection + '/' + write.rkey
      data = await data.add(dataKey, cid)
    }
    const dataDiff = await data.blockDiff()
    newBlocks.addMap(dataDiff.blocks)

    const meta: RepoMeta = {
      did,
      version: 1,
      datastore: 'mst',
    }
    const metaCid = await newBlocks.add(meta)

    const root: RepoRoot = {
      meta: metaCid,
      prev: null,
      data: dataDiff.root,
    }
    const rootCid = await newBlocks.add(root)

    const commit: Commit = {
      root: rootCid,
      sig: await keypair.sign(rootCid.bytes),
    }
    const commitCid = await newBlocks.add(commit)

    return {
      root: commitCid,
      prev: null,
      blocks: newBlocks,
    }
  }

  static async create(
    storage: RepoStorage,
    did: string,
    keypair: crypto.Keypair,
    initialRecords: RecordCreateOp[] = [],
  ): Promise<Repo> {
    const commit = await Repo.formatInitCommit(
      storage,
      did,
      keypair,
      initialRecords,
    )
    await storage.applyCommit(commit)
    log.info({ did }, `created repo`)
    return Repo.load(storage, commit.root)
  }

  static async load(storage: RepoStorage, cid?: CID) {
    const commitCid = cid || (await storage.getHead())
    if (!commitCid) {
      throw new Error('No cid provided and none in storage')
    }
    const commit = await storage.get(commitCid, def.commit)
    const root = await storage.get(commit.root, def.repoRoot)
    const meta = await storage.get(root.meta, def.repoMeta)
    const data = await MST.load(storage, root.data)
    log.info({ did: meta.did }, 'loaded repo for')
    return new Repo({
      storage,
      data,
      commit,
      root,
      meta,
      cid: commitCid,
    })
  }

  async createCommit(
    toWrite: RecordWriteOp | RecordWriteOp[],
    keypair: crypto.Keypair,
  ): Promise<CommitData> {
    const writes = Array.isArray(toWrite) ? toWrite : [toWrite]
    const newBlocks = new BlockMap()

    let data = this.data
    for (const write of writes) {
      if (write.action === WriteOpAction.Create) {
        const cid = await newBlocks.add(write.value)
        const dataKey = write.collection + '/' + write.rkey
        data = await data.add(dataKey, cid)
      } else if (write.action === WriteOpAction.Update) {
        const cid = await newBlocks.add(write.value)
        const dataKey = write.collection + '/' + write.rkey
        data = await data.update(dataKey, cid)
      } else if (write.action === WriteOpAction.Delete) {
        const dataKey = write.collection + '/' + write.rkey
        data = await data.delete(dataKey)
      }
    }

    const dataDiff = await data.blockDiff()
    newBlocks.addMap(dataDiff.blocks)

    const root: RepoRoot = {
      meta: this.root.meta,
      prev: this.cid,
      data: dataDiff.root,
    }
    const rootCid = await newBlocks.add(root)

    const commit: Commit = {
      root: rootCid,
      sig: await keypair.sign(rootCid.bytes),
    }
    const commitCid = await newBlocks.add(commit)

    return {
      root: commitCid,
      prev: this.cid,
      blocks: newBlocks,
    }
  }

  async applyCommit(
    toWrite: RecordWriteOp | RecordWriteOp[],
    keypair: crypto.Keypair,
  ): Promise<Repo> {
    const commit = await this.createCommit(toWrite, keypair)
    await this.storage.applyCommit(commit)
    return Repo.load(this.storage, commit.root)
  }

  async revert(count: number): Promise<Repo> {
    let revertTo = this.cid
    for (let i = 0; i < count; i++) {
      const commit = await this.storage.get(revertTo, def.commit)
      const root = await this.storage.get(commit.root, def.repoRoot)
      if (root.prev === null) {
        throw new Error(`Could not revert ${count} commits`)
      }
      revertTo = root.prev
    }
    return Repo.load(this.storage, revertTo)
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
      return this.writeCommitsToCarStream(car, this.cid, to)
    })
  }

  async getFullHistory(): Promise<Uint8Array> {
    return this.getDiffCar(null)
  }

  protected async openCar(
    fn: (car: BlockWriter) => Promise<void>,
  ): Promise<Uint8Array> {
    const { writer, out } = CarWriter.create([this.cid])
    const bytes = streamToArray(out)
    try {
      await fn(writer)
    } finally {
      writer.close()
    }
    return bytes
  }

  async writeCheckoutToCarStream(car: BlockWriter): Promise<void> {
    const commit = await verifyObj(this.storage, this.cid, def.commit)
    await car.put({ cid: this.cid, bytes: commit.bytes })
    const root = await verifyObj(this.storage, commit.obj.root, def.repoRoot)
    await car.put({ cid: commit.obj.root, bytes: root.bytes })
    const meta = await verifyObj(this.storage, root.obj.meta, def.repoMeta)
    await car.put({ cid: root.obj.meta, bytes: meta.bytes })
    await this.data.writeToCarStream(car)
  }

  async writeCommitsToCarStream(
    car: BlockWriter,
    latest: CID,
    earliest: CID | null,
  ): Promise<void> {
    const commits = await this.storage.getCommits(latest, earliest)
    if (commits === null) {
      throw new Error('Could not find shared history')
    }
    if (commits.length === 0) return
    for (const commit of commits) {
      for (const entry of commit.blocks.entries()) {
        await car.put(entry)
      }
    }
  }
}

export default Repo
