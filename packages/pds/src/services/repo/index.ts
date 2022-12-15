import { CID } from 'multiformats/cid'
import * as auth from '@atproto/auth'
import { BlobStore, Repo } from '@atproto/repo'
import { InvalidRequestError } from '@atproto/xrpc-server'
import Database from '../../db'
import { dbLogger as log } from '../../logger'
import { MessageQueue } from '../../event-stream/types'
import SqlBlockstore from '../../sql-blockstore'
import { PreparedCreate, PreparedWrite } from '../../repo/types'
import { RecordService } from '../record'
import { RepoBlobs } from './blobs'
import { createWriteToOp, writeToOp } from '../../repo'

export class RepoService {
  blobs: RepoBlobs

  constructor(
    public db: Database,
    public messageQueue: MessageQueue,
    public blobstore: BlobStore,
  ) {
    this.blobs = new RepoBlobs(db, blobstore)
  }

  static creator(messageQueue: MessageQueue, blobstore: BlobStore) {
    return (db: Database) => new RepoService(db, messageQueue, blobstore)
  }

  async getRepoRoot(did: string, forUpdate?: boolean): Promise<CID | null> {
    let builder = this.db.db
      .selectFrom('repo_root')
      .selectAll()
      .where('did', '=', did)
    if (forUpdate) {
      this.db.assertTransaction()
      if (this.db.dialect !== 'sqlite') {
        // SELECT FOR UPDATE is not supported by sqlite, but sqlite txs are SERIALIZABLE so we don't actually need it
        builder = builder.forUpdate()
      }
    }
    const found = await builder.executeTakeFirst()
    return found ? CID.parse(found.root) : null
  }

  async updateRepoRoot(
    did: string,
    root: CID,
    prev: CID,
    timestamp?: string,
  ): Promise<boolean> {
    log.debug({ did, root: root.toString() }, 'updating repo root')
    const res = await this.db.db
      .updateTable('repo_root')
      .set({
        root: root.toString(),
        indexedAt: timestamp || new Date().toISOString(),
      })
      .where('did', '=', did)
      .where('root', '=', prev.toString())
      .executeTakeFirst()
    if (res.numUpdatedRows > 0) {
      log.info({ did, root: root.toString() }, 'updated repo root')
      return true
    } else {
      log.info(
        { did, root: root.toString() },
        'failed to update repo root: misordered',
      )
      return false
    }
  }

  async isUserControlledRepo(
    repoDid: string,
    userDid: string | null,
  ): Promise<boolean> {
    if (!userDid) return false
    if (repoDid === userDid) return true
    const found = await this.db.db
      .selectFrom('did_handle')
      .leftJoin('scene', 'scene.handle', 'did_handle.handle')
      .where('did_handle.did', '=', repoDid)
      .where('scene.owner', '=', userDid)
      .select('scene.owner')
      .executeTakeFirst()
    return !!found
  }

  async createRepo(
    did: string,
    authStore: auth.AuthStore,
    writes: PreparedCreate[],
    now: string,
  ) {
    this.db.assertTransaction()
    const blockstore = new SqlBlockstore(this.db, did, now)
    const writeOps = writes.map(createWriteToOp)
    const repo = await Repo.create(blockstore, did, authStore, writeOps)
    await this.db.db
      .insertInto('repo_root')
      .values({
        did: did,
        root: repo.cid.toString(),
        indexedAt: now,
      })
      .execute()
  }

  async processWrites(
    did: string,
    authStore: auth.AuthStore,
    writes: PreparedWrite[],
    now: string,
  ) {
    // make structural write to repo & send to indexing
    // @TODO get commitCid first so we can do all db actions in tandem
    const [commit] = await Promise.all([
      this.writeToRepo(did, authStore, writes, now),
      this.indexWrites(writes, now),
    ])
    // make blobs permanent & associate w commit + recordUri in DB
    await this.blobs.processWriteBlobs(did, commit, writes)
  }

  async writeToRepo(
    did: string,
    authStore: auth.AuthStore,
    writes: PreparedWrite[],
    now: string,
  ): Promise<CID> {
    this.db.assertTransaction()
    const blockstore = new SqlBlockstore(this.db, did, now)
    const currRoot = await this.getRepoRoot(did, true)
    if (!currRoot) {
      throw new InvalidRequestError(
        `${did} is not a registered repo on this server`,
      )
    }
    const writeOps = writes.map(writeToOp)
    const repo = await Repo.load(blockstore, currRoot)
    const updated = await repo
      .stageUpdate(writeOps)
      .createCommit(authStore, async (prev, curr) => {
        const success = await this.updateRepoRoot(did, curr, prev, now)
        if (!success) {
          throw new Error('Repo root update failed, could not linearize')
        }
        return null
      })
    return updated.cid
  }

  async indexWrites(writes: PreparedWrite[], now: string) {
    this.db.assertTransaction()
    const recordTxn = new RecordService(this.db, this.messageQueue)
    await Promise.all(
      writes.map(async (write) => {
        if (write.action === 'create') {
          await recordTxn.indexRecord(write.uri, write.cid, write.record, now)
        } else if (write.action === 'delete') {
          await recordTxn.deleteRecord(write.uri)
        }
      }),
    )
  }
}
