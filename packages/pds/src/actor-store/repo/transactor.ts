import { CID } from 'multiformats/cid'
import * as crypto from '@atproto/crypto'
import { BlobStore, CommitData, Repo, WriteOpAction } from '@atproto/repo'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AtUri } from '@atproto/syntax'
import { SqlRepoTransactor } from './sql-repo-transactor'
import {
  BadCommitSwapError,
  BadRecordSwapError,
  PreparedCreate,
  PreparedWrite,
} from '../../repo/types'
import { BlobTransactor } from '../blob/transactor'
import { createWriteToOp, writeToOp } from '../../repo'
import { BackgroundQueue } from '../../background'
import { ActorDb } from '../db'
import { RecordTransactor } from '../record/transactor'
import { RepoReader } from './reader'

export class RepoTransactor extends RepoReader {
  blob: BlobTransactor
  record: RecordTransactor
  storage: SqlRepoTransactor
  now: string

  constructor(
    public db: ActorDb,
    public did: string,
    public signingKey: crypto.Keypair,
    public blobstore: BlobStore,
    public backgroundQueue: BackgroundQueue,
    now?: string,
  ) {
    super(db, blobstore)
    this.blob = new BlobTransactor(db, blobstore, backgroundQueue)
    this.record = new RecordTransactor(db, blobstore)
    this.now = now ?? new Date().toISOString()
    this.storage = new SqlRepoTransactor(db, this.did, this.now)
  }

  async createRepo(writes: PreparedCreate[]): Promise<CommitData> {
    this.db.assertTransaction()
    const writeOps = writes.map(createWriteToOp)
    const commit = await Repo.formatInitCommit(
      this.storage,
      this.did,
      this.signingKey,
      writeOps,
    )
    await Promise.all([
      this.storage.applyCommit(commit, true),
      this.indexWrites(writes, commit.rev),
      this.blob.processWriteBlobs(commit.rev, writes),
    ])
    return commit
  }

  async processWrites(writes: PreparedWrite[], swapCommitCid?: CID) {
    this.db.assertTransaction()
    const commit = await this.formatCommit(writes, swapCommitCid)
    await Promise.all([
      // persist the commit to repo storage
      this.storage.applyCommit(commit),
      // & send to indexing
      this.indexWrites(writes, commit.rev),
      // process blobs
      this.blob.processWriteBlobs(commit.rev, writes),
    ])
    return commit
  }

  async formatCommit(
    writes: PreparedWrite[],
    swapCommit?: CID,
  ): Promise<CommitData> {
    // this is not in a txn, so this won't actually hold the lock,
    // we just check if it is currently held by another txn
    const currRoot = await this.storage.getRootDetailed()
    if (!currRoot) {
      throw new InvalidRequestError(`No repo root found for ${this.did}`)
    }
    if (swapCommit && !currRoot.cid.equals(swapCommit)) {
      throw new BadCommitSwapError(currRoot.cid)
    }
    // cache last commit since there's likely overlap
    await this.storage.cacheRev(currRoot.rev)
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

    const repo = await Repo.load(this.storage, currRoot.cid)
    const writeOps = writes.map(writeToOp)
    const commit = await repo.formatCommit(writeOps, this.signingKey)

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
      const missingBlocks = await this.storage.getBlocks(
        newRecordBlocks.missing,
      )
      commit.newBlocks.addMap(missingBlocks.blocks)
    }
    return commit
  }

  async indexWrites(writes: PreparedWrite[], rev: string) {
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
            this.now,
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
}
