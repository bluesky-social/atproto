import { CID } from 'multiformats/cid'
import * as crypto from '@atproto/crypto'
import {
  Commit,
  def,
  RecordCreateOp,
  RecordWriteOp,
  CommitData,
  WriteOpAction,
  RebaseData,
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
  data: MST
  commit: Commit
  cid: CID
}

export class Repo extends ReadableRepo {
  storage: RepoStorage

  constructor(params: Params) {
    super(params)
    this.storage = params.storage
  }

  static async formatInitCommit(
    storage: RepoStorage,
    did: string,
    keypair: crypto.Keypair,
    initialWrites: RecordCreateOp[] = [],
  ): Promise<CommitData> {
    const newBlocks = new BlockMap()

    let data = await MST.create(storage)
    for (const record of initialWrites) {
      const cid = await newBlocks.add(record.record)
      const dataKey = util.formatDataKey(record.collection, record.rkey)
      data = await data.add(dataKey, cid)
    }

    const unstoredData = await data.getUnstoredBlocks()
    newBlocks.addMap(unstoredData.blocks)

    const commit = await util.signCommit(
      {
        did,
        version: 2,
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

  static async createFromCommit(
    storage: RepoStorage,
    commit: CommitData,
  ): Promise<Repo> {
    await storage.applyCommit(commit)
    return Repo.load(storage, commit.commit)
  }

  static async create(
    storage: RepoStorage,
    did: string,
    keypair: crypto.Keypair,
    initialWrites: RecordCreateOp[] = [],
  ): Promise<Repo> {
    const commit = await Repo.formatInitCommit(
      storage,
      did,
      keypair,
      initialWrites,
    )
    return Repo.createFromCommit(storage, commit)
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
    const commitBlocks = new BlockMap()

    let data = this.data
    for (const write of writes) {
      if (write.action === WriteOpAction.Create) {
        const cid = await commitBlocks.add(write.record)
        const dataKey = write.collection + '/' + write.rkey
        data = await data.add(dataKey, cid)
      } else if (write.action === WriteOpAction.Update) {
        const cid = await commitBlocks.add(write.record)
        const dataKey = write.collection + '/' + write.rkey
        data = await data.update(dataKey, cid)
      } else if (write.action === WriteOpAction.Delete) {
        const dataKey = write.collection + '/' + write.rkey
        data = await data.delete(dataKey)
      }
    }

    const unstoredData = await data.getUnstoredBlocks()
    commitBlocks.addMap(unstoredData.blocks)

    // ensure we're not missing any blocks that were removed and then readded in this commit
    const diff = await DataDiff.of(data, this.data)
    const found = commitBlocks.getMany(diff.newCidList())
    if (found.missing.length > 0) {
      const fromStorage = await this.storage.getBlocks(found.missing)
      if (fromStorage.missing.length > 0) {
        // this shouldn't ever happen
        throw new Error(
          'Could not find block for commit in Datastore or storage',
        )
      }
      commitBlocks.addMap(fromStorage.blocks)
    }

    const commit = await util.signCommit(
      {
        did: this.did,
        version: 2,
        prev: this.cid,
        data: unstoredData.root,
      },
      keypair,
    )
    const commitCid = await commitBlocks.add(commit)

    return {
      commit: commitCid,
      prev: this.cid,
      blocks: commitBlocks,
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

  async formatRebase(keypair: crypto.Keypair): Promise<RebaseData> {
    const preservedCids = await this.data.allCids()
    const blocks = new BlockMap()
    const commit = await util.signCommit(
      {
        did: this.did,
        version: 2,
        prev: null,
        data: this.commit.data,
      },
      keypair,
    )
    const commitCid = await blocks.add(commit)
    return {
      commit: commitCid,
      rebased: this.cid,
      blocks,
      preservedCids: preservedCids.toList(),
    }
  }

  async applyRebase(rebase: RebaseData): Promise<Repo> {
    await this.storage.applyRebase(rebase)
    return Repo.load(this.storage, rebase.commit)
  }

  async rebase(keypair: crypto.Keypair): Promise<Repo> {
    const rebaseData = await this.formatRebase(keypair)
    return this.applyRebase(rebaseData)
  }
}

export default Repo
