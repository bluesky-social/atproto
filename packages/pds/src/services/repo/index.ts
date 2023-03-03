import { CID } from 'multiformats/cid'
import * as crypto from '@atproto/crypto'
import { BlobStore, CommitData, Repo, WriteOpAction } from '@atproto/repo'
import { InvalidRequestError } from '@atproto/xrpc-server'
import Database from '../../db'
import { MessageQueue } from '../../event-stream/types'
import SqlRepoStorage from '../../sql-repo-storage'
import { PreparedCreate, PreparedWrite } from '../../repo/types'
import { RepoBlobs } from './blobs'
import { createWriteToOp, writeToOp } from '../../repo'
import { RecordService } from '../record'

export class RepoService {
  blobs: RepoBlobs

  constructor(
    public db: Database,
    public keypair: crypto.Keypair,
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
    const repo = await Repo.create(storage, did, this.keypair, writeOps)
    await Promise.all([
      this.indexCreatesAndDeletes(writes, now),
      this.afterWriteProcessing(did, repo.cid, writes),
    ])
  }

  async processCreatesAndDeletes(
    did: string,
    writes: PreparedWrite[],
    now: string,
  ) {
    await this.processWrites(did, writes, now, () =>
      this.indexCreatesAndDeletes(writes, now),
    )
  }

  async processWrites(
    did: string,
    writes: PreparedWrite[],
    now: string,
    indexWrites: (commit: CID) => Promise<void>,
  ) {
    this.db.assertTransaction()
    const storage = new SqlRepoStorage(this.db, did, now)
    const commitData = await this.formatCommit(storage, did, writes)
    await Promise.all([
      // persist the commit to repo storage
      await storage.applyCommit(commitData),
      // & send to indexing
      indexWrites(commitData.commit),
      // do any other processing needed after write
      this.afterWriteProcessing(did, commitData.commit, writes),
    ])
  }

  async formatCommit(
    storage: SqlRepoStorage,
    did: string,
    writes: PreparedWrite[],
  ): Promise<CommitData> {
    const currRoot = await storage.getHead(true)
    if (!currRoot) {
      throw new InvalidRequestError(
        `${did} is not a registered repo on this server`,
      )
    }
    const writeOps = writes.map(writeToOp)
    const repo = await Repo.load(storage, currRoot)
    return repo.formatCommit(writeOps, this.keypair)
  }

  async applyCommit(
    did: string,
    writes: PreparedWrite[],
    now: string,
  ): Promise<CID> {
    this.db.assertTransaction()
    const storage = new SqlRepoStorage(this.db, did, now)
    const commit = await this.formatCommit(storage, did, writes)
    await storage.applyCommit(commit)
    return commit.commit
  }

  async indexCreatesAndDeletes(writes: PreparedWrite[], now: string) {
    this.db.assertTransaction()
    const recordTxn = this.services.record(this.db)
    await Promise.all(
      writes.map(async (write) => {
        if (write.action === WriteOpAction.Create) {
          await recordTxn.indexRecord(write.uri, write.cid, write.record, now)
        } else if (write.action === WriteOpAction.Delete) {
          await recordTxn.deleteRecord(write.uri)
        }
      }),
    )
  }

  async afterWriteProcessing(
    did: string,
    commit: CID,
    writes: PreparedWrite[],
  ) {
    await Promise.all([
      this.blobs.processWriteBlobs(did, commit, writes),
      this.indexRepoOps(did, commit, writes),
      this.sequenceWrite(did, commit),
    ])
  }

  async indexRepoOps(did: string, commit: CID, writes: PreparedWrite[]) {
    const ops = writes.map((w) => {
      const path = w.uri.collection + '/' + w.uri.rkey
      const cid = w.action === WriteOpAction.Delete ? null : w.cid.toString()
      return {
        did,
        commit: commit.toString(),
        action: w.action,
        path,
        cid,
      }
    })
    await this.db.db.insertInto('repo_op').values(ops).execute()
  }

  async sequenceWrite(did: string, commit: CID) {
    await this.db.db
      .insertInto('repo_seq')
      .values({
        did,
        commit: commit.toString(),
        eventType: 'repo_append',
        sequencedAt: new Date().toISOString(),
      })
      .execute()
    await this.db.notify('repo_seq')
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
