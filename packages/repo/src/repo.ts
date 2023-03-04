import { CID } from 'multiformats/cid'
import * as cbor from '@ipld/dag-cbor'
import * as crypto from '@atproto/crypto'
import {
  Commit,
  def,
  DataStore,
  RecordCreateOp,
  RecordWriteOp,
  CommitData,
  WriteOpAction,
  UnsignedCommit,
} from './types'
import { RepoStorage } from './storage'
import { MST } from './mst'
import DataDiff from './data-diff'
import log from './logger'
import BlockMap from './block-map'
import { ReadableRepo } from './readable-repo'
import * as util from './util'

type Params = {
  storage: RepoStorage
  data: DataStore
  commit: Commit
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
      const cid = await newBlocks.add(write.record)
      const dataKey = write.collection + '/' + write.rkey
      data = await data.add(dataKey, cid)
    }
    const unstoredData = await data.getUnstoredBlocks()
    newBlocks.addMap(unstoredData.blocks)

    const commit = util.signCommit(
      {
        did,
        version: 1,
        prev: null,
        data: unstoredData.root,
      },
      keypair,
    )
    const commitCid = await newBlocks.add(commit)

    return {
      commit: commitCid,
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
    return Repo.load(storage, commit.commit)
  }

  static async load(storage: RepoStorage, cid?: CID) {
    const commitCid = cid || (await storage.getHead())
    if (!commitCid) {
      throw new Error('No cid provided and none in storage')
    }
    const commit = await storage.readObj(commitCid, def.commit)
    const data = await MST.load(storage, commit.data)
    log.info({ did: commit.did }, 'loaded repo for')
    return new Repo({
      storage,
      data,
      commit,
      cid: commitCid,
    })
  }

  async formatCommit(
    toWrite: RecordWriteOp | RecordWriteOp[],
    keypair: crypto.Keypair,
  ): Promise<CommitData> {
    const writes = Array.isArray(toWrite) ? toWrite : [toWrite]
    const newBlocks = new BlockMap()

    let data = this.data
    for (const write of writes) {
      if (write.action === WriteOpAction.Create) {
        const cid = await newBlocks.add(write.record)
        const dataKey = write.collection + '/' + write.rkey
        data = await data.add(dataKey, cid)
      } else if (write.action === WriteOpAction.Update) {
        const cid = await newBlocks.add(write.record)
        const dataKey = write.collection + '/' + write.rkey
        data = await data.update(dataKey, cid)
      } else if (write.action === WriteOpAction.Delete) {
        const dataKey = write.collection + '/' + write.rkey
        data = await data.delete(dataKey)
      }
    }

    const unstoredData = await data.getUnstoredBlocks()
    newBlocks.addMap(unstoredData.blocks)

    // ensure we're not missing any blocks that were removed and then readded in this commit
    const diff = await DataDiff.of(data, this.data)
    const found = newBlocks.getMany(diff.newCidList())
    if (found.missing.length > 0) {
      const fromStorage = await this.storage.getBlocks(found.missing)
      if (fromStorage.missing.length > 0) {
        // this shouldn't ever happen
        throw new Error(
          'Could not find block for commit in Datastore or storage',
        )
      }
      newBlocks.addMap(fromStorage.blocks)
    }

    const commit = await util.signCommit(
      {
        ...this.commit,
        prev: this.cid,
        data: unstoredData.root,
      },
      keypair,
    )
    const commitCid = await newBlocks.add(commit)

    return {
      commit: commitCid,
      prev: this.cid,
      blocks: newBlocks,
    }
  }

  async applyCommit(commitData: CommitData): Promise<Repo> {
    await this.storage.applyCommit(commitData)
    return Repo.load(this.storage, commitData.commit)
  }

  async applyWrites(
    toWrite: RecordWriteOp | RecordWriteOp[],
    keypair: crypto.Keypair,
  ): Promise<Repo> {
    const commit = await this.formatCommit(toWrite, keypair)
    return this.applyCommit(commit)
  }
}

export default Repo
