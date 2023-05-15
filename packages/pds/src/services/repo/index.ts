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
import * as sequencer from '../../sequencer'
import { Labeler } from '../../labeler'
import { wait } from '@atproto/common'
import { BackgroundQueue } from '../../event-stream/background-queue'

export class RepoService {
  blobs: RepoBlobs

  constructor(
    public db: Database,
    public repoSigningKey: crypto.Keypair,
    public messageDispatcher: MessageQueue,
    public blobstore: BlobStore,
    public backgroundQueue: BackgroundQueue,
    public labeler: Labeler,
  ) {
    this.blobs = new RepoBlobs(db, blobstore, backgroundQueue)
  }

  static creator(
    keypair: crypto.Keypair,
    messageDispatcher: MessageQueue,
    blobstore: BlobStore,
    backgroundQueue: BackgroundQueue,
    labeler: Labeler,
  ) {
    return (db: Database) =>
      new RepoService(
        db,
        keypair,
        messageDispatcher,
        blobstore,
        backgroundQueue,
        labeler,
      )
  }

  services = {
    record: RecordService.creator(this.messageDispatcher),
  }

  private async serviceTx<T>(
    fn: (srvc: RepoService) => Promise<T>,
  ): Promise<T> {
    this.db.assertNotTransaction()
    return this.db.transaction((dbTxn) => {
      const srvc = new RepoService(
        dbTxn,
        this.repoSigningKey,
        this.messageDispatcher,
        this.blobstore,
        this.backgroundQueue,
        this.labeler,
      )
      return fn(srvc)
    })
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

  async processCommit(
    did: string,
    writes: PreparedWrite[],
    commitData: CommitData,
    now: string,
  ) {
    this.db.assertTransaction()
    const storage = new SqlRepoStorage(this.db, did, now)
    const locked = await storage.lockHead()
    if (!locked || !locked.equals(commitData.prev)) {
      throw new ConcurrentWriteError()
    }
    await Promise.all([
      // persist the commit to repo storage
      storage.applyCommit(commitData),
      // & send to indexing
      this.indexWrites(writes, now),
      // do any other processing needed after write
      this.afterWriteProcessing(did, commitData, writes),
    ])
  }

  async processWrites(
    toWrite: { did: string; writes: PreparedWrite[]; swapCommitCid?: CID },
    times: number,
    timeout = 100,
  ) {
    this.db.assertNotTransaction()
    const { did, writes, swapCommitCid } = toWrite
    const storage = new SqlRepoStorage(this.db, did)
    const commit = await this.formatCommit(storage, did, writes, swapCommitCid)
    try {
      await this.serviceTx(async (srvcTx) =>
        srvcTx.processCommit(did, writes, commit, new Date().toISOString()),
      )
    } catch (err) {
      if (err instanceof ConcurrentWriteError) {
        if (times <= 1) {
          throw err
        }
        await wait(timeout)
        return this.processWrites(toWrite, times - 1, timeout)
      } else {
        throw err
      }
    }
  }

  async formatCommit(
    storage: SqlRepoStorage,
    did: string,
    writes: PreparedWrite[],
    swapCommit?: CID,
  ): Promise<CommitData> {
    const currRoot = await storage.getHead()
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
    const [seqEvt] = await Promise.all([
      sequencer.formatSeqCommit(did, commitData, writes),
      this.blobs.processWriteBlobs(did, commitData.commit, writes),
    ])

    await sequencer.sequenceEvt(this.db, seqEvt)

    // @TODO move to appview
    writes.map((write) => {
      if (
        write.action === WriteOpAction.Create ||
        write.action === WriteOpAction.Update
      ) {
        this.labeler.processRecord(write.uri, write.record)
      }
    })
  }

  async rebaseRepo(did: string, swapCommit?: CID) {
    this.db.assertNotTransaction()
    const storage = new SqlRepoStorage(this.db, did)
    const currRoot = await storage.getHead()
    if (!currRoot) {
      throw new InvalidRequestError(
        `${did} is not a registered repo on this server`,
      )
    }
    const repo = await Repo.load(storage, currRoot)
    const rebaseData = await repo.formatRebase(this.repoSigningKey)

    // rebases are expensive & should be done rarely, we don't try to re-process on concurrent writes
    await this.serviceTx(async (srvcTx) =>
      srvcTx.processRebase(did, rebaseData, swapCommit),
    )
  }

  async processRebase(
    did: string,
    rebaseData: RebaseData,
    swapCommit?: CID,
    now?: string,
  ) {
    this.db.assertTransaction()
    const storage = new SqlRepoStorage(this.db, did, now)
    const currRoot = await storage.lockHead()
    if (!currRoot) {
      throw new ConcurrentWriteError()
    }
    if (swapCommit && !currRoot.equals(swapCommit)) {
      throw new BadCommitSwapError(currRoot)
    }
    await Promise.all([
      storage.applyRebase(rebaseData),
      this.afterRebaseProcessing(did, rebaseData),
    ])
  }

  async afterRebaseProcessing(did: string, rebaseData: RebaseData) {
    const [seqEvt] = await Promise.all([
      sequencer.formatSeqRebase(did, rebaseData),
      this.blobs.processRebaseBlobs(did, rebaseData.commit),
    ])
    await sequencer.sequenceEvt(this.db, seqEvt)
  }

  async deleteRepo(did: string) {
    // Not done in transaction because it would be too long, prone to contention.
    // Also, this can safely be run multiple times if it fails.
    // delete all blocks from this did & no other did
    await this.db.db.deleteFrom('repo_root').where('did', '=', did).execute()
    await this.db.db.deleteFrom('repo_seq').where('did', '=', did).execute()
    await this.db.db
      .deleteFrom('repo_commit_block')
      .where('creator', '=', did)
      .execute()
    await this.db.db
      .deleteFrom('repo_commit_history')
      .where('creator', '=', did)
      .execute()
    await this.db.db
      .deleteFrom('ipld_block')
      .where('creator', '=', did)
      .execute()
    await this.blobs.deleteForUser(did)
  }
}

export class ConcurrentWriteError extends Error {
  constructor() {
    super('too many concurrent writes')
  }
}
