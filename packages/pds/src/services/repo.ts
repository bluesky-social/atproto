import { CID } from 'multiformats/cid'
import { dbLogger as log } from '../logger'
import Database from '../db'

export class RepoService {
  constructor(public db: Database) {}

  using(db: Database) {
    return new RepoService(db)
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
}
