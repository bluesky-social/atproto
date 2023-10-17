import { CID } from 'multiformats/cid'
import * as crypto from '@atproto/crypto'
import { BlobStore, CommitData, Repo, WriteOpAction } from '@atproto/repo'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AtUri } from '@atproto/syntax'
import Database from '../../db'
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
import { wait } from '@atproto/common'
import { BackgroundQueue } from '../../background'
import { Crawlers } from '../../crawlers'

export class RepoService {
  blobs: RepoBlobs

  constructor(
    public db: Database,
    public repoSigningKey: crypto.Keypair,
    public blobstore: BlobStore,
    public backgroundQueue: BackgroundQueue,
    public crawlers: Crawlers,
  ) {
    this.blobs = new RepoBlobs(db, blobstore, backgroundQueue)
  }

  static creator(
    keypair: crypto.Keypair,
    blobstore: BlobStore,
    backgroundQueue: BackgroundQueue,
    crawlers: Crawlers,
  ) {
    return (db: Database) =>
      new RepoService(db, keypair, blobstore, backgroundQueue, crawlers)
  }

  services = {
    record: RecordService.creator(),
  }

  private async serviceTx<T>(
    fn: (srvc: RepoService) => Promise<T>,
  ): Promise<T> {
    this.db.assertNotTransaction()
    return this.db.transaction((dbTxn) => {
      const srvc = new RepoService(
        dbTxn,
        this.repoSigningKey,
        this.blobstore,
        this.backgroundQueue,
        this.crawlers,
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
      this.blobs.processWriteBlobs(did, commit.rev, writes),
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
    const obtained = await storage.lockRepo()
    if (!obtained) {
      throw new ConcurrentWriteError()
    }
    await Promise.all([
      // persist the commit to repo storage
      storage.applyCommit(commitData),
      // & send to indexing
      this.indexWrites(writes, now, commitData.rev),
      // process blobs
      this.blobs.processWriteBlobs(did, commitData.rev, writes),
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
    try {
      const commit = await this.formatCommit(
        storage,
        did,
        writes,
        swapCommitCid,
      )
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
    // this is not in a txn, so this won't actually hold the lock,
    // we just check if it is currently held by another txn
    const available = await storage.lockAvailable()
    if (!available) {
      throw new ConcurrentWriteError()
    }
    const currRoot = await storage.getRootDetailed()
    if (!currRoot) {
      throw new InvalidRequestError(
        `${did} is not a registered repo on this server`,
      )
    }
    if (swapCommit && !currRoot.cid.equals(swapCommit)) {
      throw new BadCommitSwapError(currRoot.cid)
    }
    // cache last commit since there's likely overlap
    await storage.cacheRev(currRoot.rev)
    const recordTxn = this.services.record(this.db)
    const newRecordCids: CID[] = []
    const delAndUpdateUris: AtUri[] = []
    for (const write of writes) {
      const { action, uri, swapCid } = write
      if (action !== WriteOpAction.Delete) {
        newRecordCids.push(write.cid)
      }
      if (action !== WriteOpAction.Create) {
        delAndUpdateUris.push(uri)
      }
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

    let commit: CommitData
    try {
      const repo = await Repo.load(storage, currRoot.cid)
      const writeOps = writes.map(writeToOp)
      commit = await repo.formatCommit(writeOps, this.repoSigningKey)
    } catch (err) {
      // if an error occurs, check if it is attributable to a concurrent write
      const curr = await storage.getRoot()
      if (!currRoot.cid.equals(curr)) {
        throw new ConcurrentWriteError()
      } else {
        throw err
      }
    }

    // find blocks that would be deleted but are referenced by another record
    const dupeRecordCids = await this.getDuplicateRecordCids(
      did,
      commit.removedCids.toList(),
      delAndUpdateUris,
    )
    for (const cid of dupeRecordCids) {
      commit.removedCids.delete(cid)
    }

    // find blocks that are relevant to ops but not included in diff
    // (for instance a record that was moved but cid stayed the same)
    const newRecordBlocks = commit.newBlocks.getMany(newRecordCids)
    if (newRecordBlocks.missing.length > 0) {
      const missingBlocks = await storage.getBlocks(newRecordBlocks.missing)
      commit.newBlocks.addMap(missingBlocks.blocks)
    }
    return commit
  }

  async indexWrites(writes: PreparedWrite[], now: string, rev?: string) {
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
            rev,
            now,
          )
        } else if (write.action === WriteOpAction.Delete) {
          await recordTxn.deleteRecord(write.uri)
        }
      }),
    )
  }

  async getDuplicateRecordCids(
    did: string,
    cids: CID[],
    touchedUris: AtUri[],
  ): Promise<CID[]> {
    if (touchedUris.length === 0 || cids.length === 0) {
      return []
    }
    const cidStrs = cids.map((c) => c.toString())
    const uriStrs = touchedUris.map((u) => u.toString())
    const res = await this.db.db
      .selectFrom('record')
      .where('did', '=', did)
      .where('cid', 'in', cidStrs)
      .where('uri', 'not in', uriStrs)
      .select('cid')
      .execute()
    return res.map((row) => CID.parse(row.cid))
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
    })

    const seqEvt = await sequencer.formatSeqCommit(did, commitData, writes)
    await sequencer.sequenceEvt(this.db, seqEvt)
  }

  async deleteRepo(did: string) {
    // Not done in transaction because it would be too long, prone to contention.
    // Also, this can safely be run multiple times if it fails.
    // delete all blocks from this did & no other did
    await this.db.db.deleteFrom('repo_root').where('did', '=', did).execute()
    await this.db.db.deleteFrom('repo_seq').where('did', '=', did).execute()
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
