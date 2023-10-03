import { CID } from 'multiformats/cid'
import * as crypto from '@atproto/crypto'
import { BlobStore, CommitData, Repo, WriteOpAction } from '@atproto/repo'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AtUri } from '@atproto/syntax'
import SqlRepoStorage from './sql-repo-storage'
import {
  BadCommitSwapError,
  BadRecordSwapError,
  PreparedCreate,
  PreparedWrite,
} from '../../repo/types'
import { ActorBlob } from './blob'
import { createWriteToOp, writeToOp } from '../../repo'
import { BackgroundQueue } from '../../background'
import { ActorDb } from '../actor-db'
import { ActorRecordTransactor } from './record-transactor'

export class ActorRepo {
  blobs: ActorBlob
  record: ActorRecordTransactor

  constructor(
    public db: ActorDb,
    public repoSigningKey: crypto.Keypair,
    public blobstore: BlobStore,
    public backgroundQueue: BackgroundQueue,
  ) {
    this.blobs = new ActorBlob(db, blobstore, backgroundQueue)
    this.record = new ActorRecordTransactor(db)
  }

  static creator(
    keypair: crypto.Keypair,
    blobstore: BlobStore,
    backgroundQueue: BackgroundQueue,
  ) {
    return (db: ActorDb) =>
      new ActorRepo(db, keypair, blobstore, backgroundQueue)
  }

  async createRepo(writes: PreparedCreate[], now: string) {
    this.db.assertTransaction()
    const storage = new SqlRepoStorage(this.db, now)
    const writeOps = writes.map(createWriteToOp)
    const commit = await Repo.formatInitCommit(
      storage,
      this.db.did,
      this.repoSigningKey,
      writeOps,
    )
    await Promise.all([
      storage.applyCommit(commit),
      this.indexWrites(writes, now),
      this.blobs.processWriteBlobs(commit.rev, writes),
    ])
    // await this.afterWriteProcessing(did, commit, writes)
  }

  async processWrites(writes: PreparedWrite[], swapCommitCid?: CID) {
    this.db.assertTransaction()
    const now = new Date().toISOString()
    const storage = new SqlRepoStorage(this.db, now)
    const commit = await this.formatCommit(storage, writes, swapCommitCid)
    await Promise.all([
      // persist the commit to repo storage
      storage.applyCommit(commit),
      // & send to indexing
      this.indexWrites(writes, now, commit.rev),
      // process blobs
      this.blobs.processWriteBlobs(commit.rev, writes),
      // do any other processing needed after write
    ])
    // await this.afterWriteProcessing(did, commitData, writes)
  }

  async formatCommit(
    storage: SqlRepoStorage,
    writes: PreparedWrite[],
    swapCommit?: CID,
  ): Promise<CommitData> {
    // this is not in a txn, so this won't actually hold the lock,
    // we just check if it is currently held by another txn
    const currRoot = await storage.getRootDetailed()
    if (!currRoot) {
      throw new InvalidRequestError(`No repo root found for ${this.db.did}`)
    }
    if (swapCommit && !currRoot.cid.equals(swapCommit)) {
      throw new BadCommitSwapError(currRoot.cid)
    }
    // cache last commit since there's likely overlap
    await storage.cacheRev(currRoot.rev)
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
      const record = await this.record.getRecord(uri, null, true)
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

    const repo = await Repo.load(storage, currRoot.cid)
    const writeOps = writes.map(writeToOp)
    const commit = await repo.formatCommit(writeOps, this.repoSigningKey)

    // find blocks that would be deleted but are referenced by another record
    const dupeRecordCids = await this.getDuplicateRecordCids(
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
    await Promise.all(
      writes.map(async (write) => {
        if (
          write.action === WriteOpAction.Create ||
          write.action === WriteOpAction.Update
        ) {
          await this.record.indexRecord(
            write.uri,
            write.cid,
            write.record,
            write.action,
            rev,
            now,
          )
        } else if (write.action === WriteOpAction.Delete) {
          await this.record.deleteRecord(write.uri)
        }
      }),
    )
  }

  async getDuplicateRecordCids(
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
      .where('cid', 'in', cidStrs)
      .where('uri', 'not in', uriStrs)
      .select('cid')
      .execute()
    return res.map((row) => CID.parse(row.cid))
  }

  // async afterWriteProcessing(
  //   did: string,
  //   commitData: CommitData,
  //   writes: PreparedWrite[],
  // ) {
  //   this.db.onCommit(() => {
  //     this.backgroundQueue.add(async () => {
  //       await this.crawlers.notifyOfUpdate()
  //     })
  //   })
  //   const seqEvt = await sequencer.formatSeqCommit(did, commitData, writes)
  //   await sequencer.sequenceEvt(this.db, seqEvt)
  // }

  async deleteRepo(_did: string) {
    // @TODO DELETE FULL SQLITE FILE
    // Not done in transaction because it would be too long, prone to contention.
    // Also, this can safely be run multiple times if it fails.
    // delete all blocks from this did & no other did
    // await this.db.db.deleteFrom('repo_root').where('did', '=', did).execute()
    // await this.db.db.deleteFrom('repo_seq').where('did', '=', did).execute()
    // await this.db.db.deleteFrom('ipld_block').execute()
    // await this.blobs.deleteForUser(did)
  }
}
