import { CID } from 'multiformats/cid'
import * as crypto from '@atproto/crypto'
import { BlobStore, Repo, WriteOpAction, formatDataKey } from '@atproto/repo'
import { AtUri } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { BackgroundQueue } from '../../background'
import { createWriteToOp, writeToOp } from '../../repo'
import {
  BadCommitSwapError,
  BadRecordSwapError,
  CommitDataWithOps,
  CommitOp,
  PreparedCreate,
  PreparedWrite,
} from '../../repo/types'
import { BlobTransactor } from '../blob/transactor'
import { ActorDb } from '../db'
import { RecordTransactor } from '../record/transactor'
import { RepoReader } from './reader'
import { SqlRepoTransactor } from './sql-repo-transactor'

export class RepoTransactor extends RepoReader {
  blob: BlobTransactor
  record: RecordTransactor
  storage: SqlRepoTransactor

  constructor(
    public db: ActorDb,
    public blobstore: BlobStore,
    public did: string,
    public signingKey: crypto.Keypair,
    public backgroundQueue: BackgroundQueue,
    public now: string = new Date().toISOString(),
  ) {
    super(db, blobstore)
    this.blob = new BlobTransactor(db, blobstore, backgroundQueue)
    this.record = new RecordTransactor(db, blobstore)
    this.storage = new SqlRepoTransactor(db, did, now)
  }

  async maybeLoadRepo(): Promise<Repo | null> {
    const res = await this.db.db
      .selectFrom('repo_root')
      .select('cid')
      .limit(1)
      .executeTakeFirst()
    return res ? Repo.load(this.storage, CID.parse(res.cid)) : null
  }

  async createRepo(writes: PreparedCreate[]): Promise<CommitDataWithOps> {
    this.db.assertTransaction()
    const commit = await Repo.formatInitCommit(
      this.storage,
      this.did,
      this.signingKey,
      writes.map(createWriteToOp),
    )
    await this.storage.applyCommit(commit, true)
    await this.indexWrites(writes, commit.rev)
    await this.blob.processWriteBlobs(commit.rev, writes)

    const ops = writes.map((w) => ({
      action: 'create' as const,
      path: formatDataKey(w.uri.collection, w.uri.rkey),
      cid: w.cid,
    }))
    return {
      ...commit,
      ops,
      prevData: null,
    }
  }

  async processWrites(
    writes: PreparedWrite[],
    swapCommitCid?: CID,
  ): Promise<CommitDataWithOps> {
    this.db.assertTransaction()
    if (writes.length > 200) {
      throw new InvalidRequestError('Too many writes. Max: 200')
    }

    const commit = await this.formatCommit(writes, swapCommitCid)
    // Do not allow commits > 2MB
    if (commit.relevantBlocks.byteSize > 2000000) {
      throw new InvalidRequestError('Too many writes. Max event size: 2MB')
    }

    // persist the commit to repo storage
    await this.storage.applyCommit(commit)
    // & send to indexing
    await this.indexWrites(writes, commit.rev)
    // process blobs
    await this.blob.processWriteBlobs(commit.rev, writes)

    return commit
  }

  async formatCommit(
    writes: PreparedWrite[],
    swapCommit?: CID,
  ): Promise<CommitDataWithOps> {
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
    const commitOps: CommitOp[] = []
    for (const write of writes) {
      const { action, uri, swapCid } = write
      if (action !== WriteOpAction.Delete) {
        newRecordCids.push(write.cid)
      }
      if (action !== WriteOpAction.Create) {
        delAndUpdateUris.push(uri)
      }
      const record = await this.record.getRecord(uri, null, true)
      const currRecord = record ? CID.parse(record.cid) : null

      const op: CommitOp = {
        action,
        path: formatDataKey(uri.collection, uri.rkey),
        cid: write.action === WriteOpAction.Delete ? null : write.cid,
      }
      if (currRecord) {
        op.prev = currRecord
      }
      commitOps.push(op)
      if (swapCid !== undefined) {
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
    }

    const repo = await Repo.load(this.storage, currRoot.cid)
    const prevData = repo.commit.data
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
    const newRecordBlocks = commit.relevantBlocks.getMany(newRecordCids)
    if (newRecordBlocks.missing.length > 0) {
      const missingBlocks = await this.storage.getBlocks(
        newRecordBlocks.missing,
      )
      commit.relevantBlocks.addMap(missingBlocks.blocks)
    }
    return {
      ...commit,
      ops: commitOps,
      prevData,
    }
  }

  async indexWrites(writes: PreparedWrite[], rev: string) {
    this.db.assertTransaction()

    for (const write of writes) {
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
    }
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
