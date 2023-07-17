import { CID } from 'multiformats/cid'
import * as crypto from '@atproto/crypto'
import {
  BlobStore,
  CommitData,
  RebaseData,
  Repo,
  WriteOpAction,
} from '@atproto/repo'
import * as repo from '@atproto/repo'
import { AtUri } from '@atproto/uri'
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
import { countAll } from '../../db/util'
import { Crawlers } from '../../crawlers'
import { ContentReporter } from '../../content-reporter'

export class RepoService {
  blobs: RepoBlobs

  constructor(
    public db: Database,
    public repoSigningKey: crypto.Keypair,
    public messageDispatcher: MessageQueue,
    public blobstore: BlobStore,
    public backgroundQueue: BackgroundQueue,
    public crawlers: Crawlers,
    public labeler: Labeler,
    public contentReporter?: ContentReporter,
  ) {
    this.blobs = new RepoBlobs(db, blobstore, backgroundQueue)
  }

  static creator(
    keypair: crypto.Keypair,
    messageDispatcher: MessageQueue,
    blobstore: BlobStore,
    backgroundQueue: BackgroundQueue,
    crawlers: Crawlers,
    labeler: Labeler,
    contentReporter?: ContentReporter,
  ) {
    return (db: Database) =>
      new RepoService(
        db,
        keypair,
        messageDispatcher,
        blobstore,
        backgroundQueue,
        crawlers,
        labeler,
        contentReporter,
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
        this.crawlers,
        this.labeler,
        this.contentReporter,
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
    await Promise.all([
      storage.applyCommit(commit),
      this.indexWrites(writes, now),
      this.blobs.processWriteBlobs(did, commit.commit, writes),
    ])
    await this.afterWriteProcessing(did, commit, writes)
  }

  async processCommit(
    did: string,
    writes: PreparedWrite[],
    commitData: CommitData,
    now: string,
  ) {
    this.db.assertTransaction()
    const storage = new SqlRepoStorage(this.db, did, now)
    const locked = await storage.lockRepo()
    if (!locked) {
      throw new ConcurrentWriteError()
    }
    await Promise.all([
      // persist the commit to repo storage
      storage.applyCommit(commitData),
      // & send to indexing
      this.indexWrites(writes, now),
      // process blobs
      this.blobs.processWriteBlobs(did, commitData.commit, writes),
      // do any other processing needed after write
    ])
    await this.afterWriteProcessing(did, commitData, writes)
  }

  async processWrites(
    toWrite: { did: string; writes: PreparedWrite[]; swapCommitCid?: CID },
    times: number,
    timeout = 100,
    prevStorage?: SqlRepoStorage,
  ) {
    this.db.assertNotTransaction()
    const { did, writes, swapCommitCid } = toWrite
    // we may have some useful cached blocks in the storage, so re-use the previous instance
    const storage = prevStorage ?? new SqlRepoStorage(this.db, did)
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
        return this.processWrites(toWrite, times - 1, timeout, storage)
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
    // cache last commit since there's likely overlap
    await storage.cacheCommit(currRoot)
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
    this.db.onCommit(() => {
      this.backgroundQueue.add(async () => {
        await this.crawlers.notifyOfUpdate()
      })
      writes.forEach((write) => {
        if (
          write.action === WriteOpAction.Create ||
          write.action === WriteOpAction.Update
        ) {
          // @TODO move to appview
          this.labeler.processRecord(write.uri, write.record)
          this.contentReporter?.checkRecord(write)
        }
      })
    })

    const seqEvt = await sequencer.formatSeqCommit(did, commitData, writes)
    await sequencer.sequenceEvt(this.db, seqEvt)
  }

  async rebaseRepo(did: string, swapCommit?: CID) {
    this.db.assertNotTransaction()

    // rebases are expensive & should be done rarely, we don't try to re-process on concurrent writes
    await this.serviceTx(async (srvcTx) => {
      const rebaseData = await srvcTx.formatRebase(did, swapCommit)
      await srvcTx.processRebase(did, rebaseData)
    })
  }

  async formatRebase(did: string, swapCommit?: CID): Promise<RebaseData> {
    const storage = new SqlRepoStorage(this.db, did, new Date().toISOString())
    const locked = await storage.lockRepo()
    if (!locked) {
      throw new ConcurrentWriteError()
    }

    const currRoot = await storage.getHead()
    if (!currRoot) {
      throw new InvalidRequestError(
        `${did} is not a registered repo on this server`,
      )
    } else if (swapCommit && !currRoot.equals(swapCommit)) {
      throw new BadCommitSwapError(currRoot)
    }

    const records = await this.db.db
      .selectFrom('record')
      .where('did', '=', did)
      .select(['uri', 'cid'])
      .execute()
    // this will do everything in memory & shouldn't touch storage until we do .getUnstoredBlocks
    let data = await repo.MST.create(storage)
    for (const record of records) {
      const uri = new AtUri(record.uri)
      const cid = CID.parse(record.cid)
      const dataKey = repo.formatDataKey(uri.collection, uri.rkey)
      data = await data.add(dataKey, cid)
    }
    // this looks for unstored blocks recursively & bails when it encounters a block it has
    // in most cases, there should be no unstored blocks, but this allows for recovery of repos in a broken state
    const unstoredData = await data.getUnstoredBlocks()
    const commit = await repo.signCommit(
      {
        did,
        version: 2,
        prev: null,
        data: unstoredData.root,
      },
      this.repoSigningKey,
    )
    const newBlocks = unstoredData.blocks
    const currCids = await data.allCids()
    const commitCid = await newBlocks.add(commit)
    return {
      commit: commitCid,
      rebased: currRoot,
      blocks: newBlocks,
      preservedCids: currCids.toList(),
    }
  }

  async processRebase(did: string, rebaseData: RebaseData) {
    this.db.assertTransaction()

    const storage = new SqlRepoStorage(this.db, did)

    const recordCountBefore = await this.countRecordBlocks(did)
    await Promise.all([
      storage.applyRebase(rebaseData),
      this.blobs.processRebaseBlobs(did, rebaseData.commit),
    ])
    const recordCountAfter = await this.countRecordBlocks(did)
    // This is purely a dummy check on a very sensitive operation
    if (recordCountBefore !== recordCountAfter) {
      throw new Error(
        `Record blocks deleted during rebase. Rolling back: ${did}`,
      )
    }

    await this.afterRebaseProcessing(did, rebaseData)
  }

  async afterRebaseProcessing(did: string, rebaseData: RebaseData) {
    const seqEvt = await sequencer.formatSeqRebase(did, rebaseData)
    await sequencer.sequenceEvt(this.db, seqEvt)
  }

  // used for integrity check
  private async countRecordBlocks(did: string): Promise<number> {
    const res = await this.db.db
      .selectFrom('record')
      .where('record.did', '=', did)
      .innerJoin('ipld_block', (join) =>
        join
          .onRef('ipld_block.creator', '=', 'record.did')
          .onRef('ipld_block.cid', '=', 'record.cid'),
      )
      .select(countAll.as('count'))
      .executeTakeFirst()
    return res?.count ?? 0
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
