import { CID } from 'multiformats/cid'
import { TID } from '@atproto/common'
import * as crypto from '@atproto/crypto'
import {
  Commit,
  CommitData,
  def,
  RecordCreateOp,
  RecordWriteOp,
  WriteOpAction,
} from './types'
import { RepoStorage } from './storage'
import { MST } from './mst'
import DataDiff from './data-diff'
import log from './logger'
import BlockMap from './block-map'
import { ReadableRepo } from './readable-repo'
import * as util from './util'
import CidSet from './cid-set'

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
    const dataCid = await data.getPointer()
    const diff = await DataDiff.of(data, null)
    newBlocks.addMap(diff.newMstBlocks)

    const rev = TID.nextStr()
    const commit = await util.signCommit(
      {
        did,
        version: 3,
        rev,
        prev: null, // added for backwards compatibility with v2
        data: dataCid,
      },
      keypair,
    )
    const commitCid = await newBlocks.add(commit)
    return {
      cid: commitCid,
      rev,
      since: null,
      prev: null,
      newBlocks,
      removedCids: diff.removedCids,
    }
  }

  static async createFromCommit(
    storage: RepoStorage,
    commit: CommitData,
  ): Promise<Repo> {
    await storage.applyCommit(commit)
    return Repo.load(storage, commit.cid)
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
    const commitCid = cid || (await storage.getRoot())
    if (!commitCid) {
      throw new Error('No cid provided and none in storage')
    }
    const commit = await storage.readObj(commitCid, def.versionedCommit)
    const data = await MST.load(storage, commit.data)
    log.info({ did: commit.did }, 'loaded repo for')
    return new Repo({
      storage,
      data,
      commit: util.ensureV3Commit(commit),
      cid: commitCid,
    })
  }

  async formatCommit(
    toWrite: RecordWriteOp | RecordWriteOp[],
    keypair: crypto.Keypair,
  ): Promise<CommitData> {
    const writes = Array.isArray(toWrite) ? toWrite : [toWrite]
    const leaves = new BlockMap()

    let data = this.data
    for (const write of writes) {
      if (write.action === WriteOpAction.Create) {
        const cid = await leaves.add(write.record)
        const dataKey = write.collection + '/' + write.rkey
        data = await data.add(dataKey, cid)
      } else if (write.action === WriteOpAction.Update) {
        const cid = await leaves.add(write.record)
        const dataKey = write.collection + '/' + write.rkey
        data = await data.update(dataKey, cid)
      } else if (write.action === WriteOpAction.Delete) {
        const dataKey = write.collection + '/' + write.rkey
        data = await data.delete(dataKey)
      }
    }

    const dataCid = await data.getPointer()
    const diff = await DataDiff.of(data, this.data)
    const newBlocks = diff.newMstBlocks
    const removedCids = diff.removedCids

    const addedLeaves = leaves.getMany(diff.newLeafCids.toList())
    if (addedLeaves.missing.length > 0) {
      throw new Error(`Missing leaf blocks: ${addedLeaves.missing}`)
    }
    newBlocks.addMap(addedLeaves.blocks)

    const rev = TID.nextStr(this.commit.rev)
    const commit = await util.signCommit(
      {
        did: this.did,
        version: 3,
        rev,
        prev: null, // added for backwards compatibility with v2
        data: dataCid,
      },
      keypair,
    )
    const commitCid = await newBlocks.add(commit)

    // ensure the commit cid actually changed
    if (commitCid.equals(this.cid)) {
      newBlocks.delete(commitCid)
    } else {
      removedCids.add(this.cid)
    }

    return {
      cid: commitCid,
      rev,
      since: this.commit.rev,
      prev: this.cid,
      newBlocks,
      removedCids,
    }
  }

  async applyCommit(commitData: CommitData): Promise<Repo> {
    await this.storage.applyCommit(commitData)
    return Repo.load(this.storage, commitData.cid)
  }

  async applyWrites(
    toWrite: RecordWriteOp | RecordWriteOp[],
    keypair: crypto.Keypair,
  ): Promise<Repo> {
    const commit = await this.formatCommit(toWrite, keypair)
    return this.applyCommit(commit)
  }

  async formatResignCommit(rev: string, keypair: crypto.Keypair) {
    const commit = await util.signCommit(
      {
        did: this.did,
        version: 3,
        rev,
        prev: null, // added for backwards compatibility with v2
        data: this.commit.data,
      },
      keypair,
    )
    const newBlocks = new BlockMap()
    const commitCid = await newBlocks.add(commit)
    return {
      cid: commitCid,
      rev,
      since: null,
      prev: null,
      newBlocks,
      removedCids: new CidSet([this.cid]),
    }
  }

  async resignCommit(rev: string, keypair: crypto.Keypair) {
    const formatted = await this.formatResignCommit(rev, keypair)
    return this.applyCommit(formatted)
  }
}

export default Repo
