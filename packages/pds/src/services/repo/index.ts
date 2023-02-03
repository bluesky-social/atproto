import { CID } from 'multiformats/cid'
import * as crypto from '@atproto/crypto'
import { BlobStore, Repo, WriteOpAction } from '@atproto/repo'
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
    public messageQueue: MessageQueue,
    public blobstore: BlobStore,
  ) {
    this.blobs = new RepoBlobs(db, blobstore)
  }

  static creator(
    keypair: crypto.Keypair,
    messageQueue: MessageQueue,
    blobstore: BlobStore,
  ) {
    return (db: Database) =>
      new RepoService(db, keypair, messageQueue, blobstore)
  }

  services = {
    record: RecordService.creator(this.messageQueue),
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
    // make structural write to repo
    const commit = await this.applyCommit(did, writes, now)
    // @TODO get commitCid first so we can do all db actions in tandem
    await Promise.all([
      // & send to indexing
      indexWrites(commit),
      // do any other processing needed after write
      this.afterWriteProcessing(did, commit, writes),
    ])
  }

  async applyCommit(
    did: string,
    writes: PreparedWrite[],
    now: string,
  ): Promise<CID> {
    this.db.assertTransaction()
    const storage = new SqlRepoStorage(this.db, did, now)
    const currRoot = await storage.getHead(true)
    if (!currRoot) {
      throw new InvalidRequestError(
        `${did} is not a registered repo on this server`,
      )
    }
    const writeOps = writes.map(writeToOp)
    const repo = await Repo.load(storage, currRoot)
    const updated = await repo.applyWrites(writeOps, this.keypair)
    return updated.cid
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
    await this.blobs.processWriteBlobs(did, commit, writes)
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
      this.blobs.deleteForUser(did),
    ])
  }
}
