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
    await Repo.create(storage, did, this.keypair, writeOps)
  }

  async processWrites(did: string, writes: PreparedWrite[], now: string) {
    // make structural write to repo & send to indexing
    // @TODO get commitCid first so we can do all db actions in tandem
    const [commit] = await Promise.all([
      this.writeToRepo(did, writes, now),
      this.indexWrites(writes, now),
    ])
    // make blobs permanent & associate w commit + recordUri in DB
    await this.blobs.processWriteBlobs(did, commit, writes)
  }

  async writeToRepo(
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
    const updated = await repo.applyCommit(writeOps, this.keypair)
    return updated.cid
  }

  async indexWrites(writes: PreparedWrite[], now: string) {
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
}
