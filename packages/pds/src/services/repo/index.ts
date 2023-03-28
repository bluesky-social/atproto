import { CID } from 'multiformats/cid'
import * as crypto from '@atproto/crypto'
import {
  BlobStore,
  CommitData,
  RebaseData,
  Repo,
  WriteOpAction,
} from '@atproto/repo'
import { InvalidRequestError } from '@atproto/xrpc-server'
import Database from '../../db'
import { MessageQueue } from '../../event-stream/types'
import SqlRepoStorage from '../../sql-repo-storage'
import {
  BadCommitSwapError,
  BadRecordSwapError,
  PreparedCreate,
  PreparedWrite,
} from '../../repo/types'
import { RepoBlobs } from './blobs'
import { createWriteToOp, writeToOp } from '../../repo'
import { RecordService } from '../record'
import { sequenceCommit, sequenceRebase } from '../../sequencer'

export class RepoService {
  blobs: RepoBlobs

  constructor(
    public db: Database,
    public repoSigningKey: crypto.Keypair,
    public messageDispatcher: MessageQueue,
    public blobstore: BlobStore,
  ) {
    this.blobs = new RepoBlobs(db, blobstore)
  }

  static creator(
    keypair: crypto.Keypair,
    messageDispatcher: MessageQueue,
    blobstore: BlobStore,
  ) {
    return (db: Database) =>
      new RepoService(db, keypair, messageDispatcher, blobstore)
  }

  services = {
    record: RecordService.creator(this.messageDispatcher),
  }

  async createRepo(did: string, writes: PreparedCreate[], now: string) {
    this.db.assertTransaction()
    const storage = new SqlRepoStorage(this.db, did, now)
    const writeOps = writes.map(createWriteToOp)
    const commit = await Repo.formatInitCommit(
      storage,
      did,
      this.repoSigningKey,
      writeOps,
    )
    await storage.applyCommit(commit)
    await Promise.all([
      this.indexWrites(writes, now),
      this.afterWriteProcessing(did, commit, writes),
    ])
  }

  async processWrites(
    did: string,
    writes: PreparedWrite[],
    now: string,
    swapCommit?: CID,
  ) {
    this.db.assertTransaction()
    const storage = new SqlRepoStorage(this.db, did, now)
    const commitData = await this.formatCommit(storage, did, writes, swapCommit)
    await Promise.all([
      // persist the commit to repo storage
      storage.applyCommit(commitData),
      // & send to indexing
      this.indexWrites(writes, now),
      // do any other processing needed after write
      this.afterWriteProcessing(did, commitData, writes),
    ])
  }

  private async formatCommit(
    storage: SqlRepoStorage,
    did: string,
    writes: PreparedWrite[],
    swapCommit?: CID,
  ): Promise<CommitData> {
    const currRoot = await storage.getHead(true)
    if (!currRoot) {
      throw new InvalidRequestError(
        `${did} is not a registered repo on this server`,
      )
    }
    if (swapCommit && !currRoot.equals(swapCommit)) {
      throw new BadCommitSwapError(currRoot)
    }
    const recordTxn = this.services.record(this.db)
    for (const write of writes) {
      const { action, uri, swapCid } = write
      if (swapCid === undefined) {
        continue
      }
      const record = await recordTxn.getRecord(uri, null, true)
      const currRecord = record && CID.parse(record.cid)
      if (action === WriteOpAction.Create && swapCid !== null) {
        throw new BadRecordSwapError(currRecord) // There should be no current record for a create
      }
      if (action === WriteOpAction.Update && swapCid === null) {
        throw new BadRecordSwapError(currRecord) // There should be a current record for an update
      }
      if (action === WriteOpAction.Delete && swapCid === null) {
        throw new BadRecordSwapError(currRecord) // There should be a current record for a delete
      }
      if ((currRecord || swapCid) && !currRecord?.equals(swapCid)) {
        throw new BadRecordSwapError(currRecord)
      }
    }
    const writeOps = writes.map(writeToOp)
    const repo = await Repo.load(storage, currRoot)
    return repo.formatCommit(writeOps, this.repoSigningKey)
  }

  async indexWrites(writes: PreparedWrite[], now: string) {
    this.db.assertTransaction()
    const recordTxn = this.services.record(this.db)
    await Promise.all(
      writes.map(async (write) => {
        if (
          write.action === WriteOpAction.Create ||
          write.action === WriteOpAction.Update
        ) {
          await recordTxn.indexRecord(
            write.uri,
            write.cid,
            write.record,
            write.action,
            now,
          )
        } else if (write.action === WriteOpAction.Delete) {
          await recordTxn.deleteRecord(write.uri)
        }
      }),
    )
  }

  async afterWriteProcessing(
    did: string,
    commitData: CommitData,
    writes: PreparedWrite[],
  ) {
    await Promise.all([
      this.blobs.processWriteBlobs(did, commitData.commit, writes),
      sequenceCommit(this.db, did, commitData, writes),
    ])
  }

  async rebaseRepo(did: string, now: string, swapCommit?: CID) {
    this.db.assertTransaction()
    const storage = new SqlRepoStorage(this.db, did, now)
    const currRoot = await storage.getHead(true)
    if (!currRoot) {
      throw new InvalidRequestError(
        `${did} is not a registered repo on this server`,
      )
    }
    if (swapCommit && !currRoot.equals(swapCommit)) {
      throw new BadCommitSwapError(currRoot)
    }
    const repo = await Repo.load(storage, currRoot)
    const rebaseData = await repo.formatRebase(this.repoSigningKey)
    await Promise.all([
      storage.applyRebase(rebaseData),
      this.afterRebaseProcessing(did, rebaseData),
    ])
  }

  async afterRebaseProcessing(did: string, rebaseData: RebaseData) {
    await Promise.all([
      this.blobs.processRebaseBlobs(did, rebaseData.commit),
      sequenceRebase(this.db, did, rebaseData),
    ])
  }

  async deleteRepo(did: string) {
    this.db.assertTransaction()
    // delete all blocks from this did & no other did
    await Promise.all([
      this.db.db.deleteFrom('ipld_block').where('creator', '=', did).execute(),
      this.db.db
        .deleteFrom('repo_commit_block')
        .where('creator', '=', did)
        .execute(),
      this.db.db
        .deleteFrom('repo_commit_history')
        .where('creator', '=', did)
        .execute(),
      this.db.db.deleteFrom('repo_root').where('did', '=', did).execute(),
      this.db.db.deleteFrom('repo_seq').where('did', '=', did).execute(),
      this.blobs.deleteForUser(did),
    ])
  }
}
