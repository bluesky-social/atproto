import { sql } from 'kysely'
import { chunkArray } from '@atproto/common'
import { Cid, parseCid } from '@atproto/lex-data'
import { BlockMap, CommitData, PreorderOp, RepoStorage } from '@atproto/repo'
import { ActorDb, RepoBlock } from '../db'
import { SqlRepoReader } from './sql-repo-reader'

export class SqlRepoTransactor extends SqlRepoReader implements RepoStorage {
  cache = new BlockMap()
  now: string

  constructor(
    public db: ActorDb,
    public did: string,
    now?: string,
  ) {
    super(db)
    this.now = now ?? new Date().toISOString()
  }

  // proactively cache all blocks from a particular commit (to prevent multiple roundtrips)
  async cacheRev(rev: string): Promise<void> {
    const res = await this.db.db
      .selectFrom('repo_block')
      .where('repoRev', '=', rev)
      .select(['repo_block.cid', 'repo_block.content'])
      .limit(15)
      .execute()
    for (const row of res) {
      this.cache.set(parseCid(row.cid), row.content)
    }
  }

  async putBlock(cid: Cid, block: Uint8Array, rev: string): Promise<void> {
    await this.db.db
      .insertInto('repo_block')
      .values({
        cid: cid.toString(),
        repoRev: rev,
        size: block.length,
        content: block,
      })
      .onConflict((oc) => oc.doNothing())
      .execute()
    this.cache.set(cid, block)
  }

  async putMany(toPut: BlockMap, rev: string): Promise<void> {
    const blocks: RepoBlock[] = Array.from(toPut, ([cid, bytes]) => ({
      cid: cid.toString(),
      repoRev: rev,
      size: bytes.length,
      content: bytes,
    }))

    for (const batch of chunkArray(blocks, 50)) {
      await this.db.db
        .insertInto('repo_block')
        .values(batch)
        .onConflict((oc) => oc.doNothing())
        .execute()
    }
  }

  async deleteMany(cids: Cid[]) {
    if (cids.length < 1) return
    const cidStrs = cids.map((c) => c.toString())
    await this.db.db
      .deleteFrom('repo_block')
      .where('cid', 'in', cidStrs)
      .execute()
  }

  async applyCommit(commit: CommitData, isCreate?: boolean) {
    await this.updateRoot(commit.cid, commit.rev, isCreate)
    await this.putMany(commit.newBlocks, commit.rev)
    await this.deleteMany(commit.removedCids.toList())
    await this.applyPreorderOps(commit.preorderOps)
  }

  async applyPreorderOps(ops: PreorderOp[]): Promise<void> {
    if (ops.length === 0) return
    const inserts: { lpath: string; depth: number; cid: string }[] = []
    const deletes: { lpath: string; depth: number }[] = []
    for (const op of ops) {
      if (op.action === 'insert') {
        inserts.push({ lpath: op.lpath, depth: op.depth, cid: op.cid })
      } else {
        deletes.push({ lpath: op.lpath, depth: op.depth })
      }
    }
    for (const batch of chunkArray(deletes, 50)) {
      const tuples = batch.map((d) => sql`(${d.lpath}, ${d.depth})`)
      await this.db.db
        .deleteFrom('preorder_map')
        .where(sql`(lpath, depth) in (${sql.join(tuples)})`)
        .execute()
    }
    for (const batch of chunkArray(inserts, 50)) {
      await this.db.db.insertInto('preorder_map').values(batch).execute()
    }
  }

  async updateRoot(cid: Cid, rev: string, isCreate = false): Promise<void> {
    if (isCreate) {
      await this.db.db
        .insertInto('repo_root')
        .values({
          did: this.did,
          cid: cid.toString(),
          rev: rev,
          indexedAt: this.now,
        })
        .execute()
    } else {
      await this.db.db
        .updateTable('repo_root')
        .set({
          cid: cid.toString(),
          rev: rev,
          indexedAt: this.now,
        })
        .execute()
    }
  }

  async destroy(): Promise<void> {
    throw new Error('Destruction of SQL repo storage not allowed at runtime')
  }
}
