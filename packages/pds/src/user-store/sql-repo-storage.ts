import {
  CommitData,
  RepoStorage,
  BlockMap,
  CidSet,
  ReadableBlockstore,
  writeCarStream,
} from '@atproto/repo'
import { chunkArray } from '@atproto/common'
import { CID } from 'multiformats/cid'
import { UserDb } from '../user-db'
import { IpldBlock } from '../user-db/tables/ipld-block'
import { sql } from 'kysely'

export class SqlRepoStorage extends ReadableBlockstore implements RepoStorage {
  cache: BlockMap = new BlockMap()

  constructor(
    public db: UserDb,
    public did: string,
    public timestamp?: string,
  ) {
    super()
  }

  async getRoot(): Promise<CID | null> {
    const root = await this.getRootDetailed()
    return root?.cid ?? null
  }

  async getRootDetailed(): Promise<{ cid: CID; rev: string } | null> {
    const res = await this.db.db
      .selectFrom('repo_root')
      .orderBy('repo_root.rev', 'desc')
      .limit(1)
      .selectAll()
      .executeTakeFirst()
    if (!res) return null
    return {
      cid: CID.parse(res.cid),
      rev: res.rev ?? '', // @TODO add not-null constraint to rev
    }
  }

  // proactively cache all blocks from a particular commit (to prevent multiple roundtrips)
  async cacheRev(rev: string): Promise<void> {
    const res = await this.db.db
      .selectFrom('ipld_block')
      .where('repoRev', '=', rev)
      .select(['ipld_block.cid', 'ipld_block.content'])
      .limit(15)
      .execute()
    for (const row of res) {
      this.cache.set(CID.parse(row.cid), row.content)
    }
  }

  async getBytes(cid: CID): Promise<Uint8Array | null> {
    const cached = this.cache.get(cid)
    if (cached) return cached
    const found = await this.db.db
      .selectFrom('ipld_block')
      .where('ipld_block.cid', '=', cid.toString())
      .select('content')
      .executeTakeFirst()
    if (!found) return null
    this.cache.set(cid, found.content)
    return found.content
  }

  async has(cid: CID): Promise<boolean> {
    const got = await this.getBytes(cid)
    return !!got
  }

  async getBlocks(cids: CID[]): Promise<{ blocks: BlockMap; missing: CID[] }> {
    const cached = this.cache.getMany(cids)
    if (cached.missing.length < 1) return cached
    const missing = new CidSet(cached.missing)
    const missingStr = cached.missing.map((c) => c.toString())
    const blocks = new BlockMap()
    await Promise.all(
      chunkArray(missingStr, 500).map(async (batch) => {
        const res = await this.db.db
          .selectFrom('ipld_block')
          .where('ipld_block.cid', 'in', batch)
          .select(['ipld_block.cid as cid', 'ipld_block.content as content'])
          .execute()
        for (const row of res) {
          const cid = CID.parse(row.cid)
          blocks.set(cid, row.content)
          missing.delete(cid)
        }
      }),
    )
    this.cache.addMap(blocks)
    blocks.addMap(cached.blocks)
    return { blocks, missing: missing.toList() }
  }

  async putBlock(cid: CID, block: Uint8Array, rev: string): Promise<void> {
    this.db.assertTransaction()
    await this.db.db
      .insertInto('ipld_block')
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
    this.db.assertTransaction()
    const blocks: IpldBlock[] = []
    toPut.forEach((bytes, cid) => {
      blocks.push({
        cid: cid.toString(),
        repoRev: rev,
        size: bytes.length,
        content: bytes,
      })
      this.cache.addMap(toPut)
    })
    await Promise.all(
      chunkArray(blocks, 500).map((batch) =>
        this.db.db
          .insertInto('ipld_block')
          .values(batch)
          .onConflict((oc) => oc.doNothing())
          .execute(),
      ),
    )
  }

  async deleteMany(cids: CID[]) {
    if (cids.length < 1) return
    const cidStrs = cids.map((c) => c.toString())
    await this.db.db
      .deleteFrom('ipld_block')
      .where('cid', 'in', cidStrs)
      .execute()
  }

  async applyCommit(commit: CommitData) {
    await Promise.all([
      this.updateRoot(commit.cid, commit.rev),
      this.putMany(commit.newBlocks, commit.rev),
      this.deleteMany(commit.removedCids.toList()),
    ])
  }

  async updateRoot(cid: CID, rev: string): Promise<void> {
    await this.db.db
      .insertInto('repo_root')
      .values({
        cid: cid.toString(),
        rev: rev,
        indexedAt: this.getTimestamp(),
      })
      .execute()
  }

  async getCarStream(since?: string) {
    const root = await this.getRoot()
    if (!root) {
      throw new RepoRootNotFoundError()
    }
    return writeCarStream(root, async (car) => {
      let cursor: RevCursor | undefined = undefined
      const writeRows = async (
        rows: { cid: string; content: Uint8Array }[],
      ) => {
        for (const row of rows) {
          await car.put({
            cid: CID.parse(row.cid),
            bytes: row.content,
          })
        }
      }
      // allow us to write to car while fetching the next page
      let writePromise: Promise<void> = Promise.resolve()
      do {
        const res = await this.getBlockRange(since, cursor)
        await writePromise
        writePromise = writeRows(res)
        const lastRow = res.at(-1)
        if (lastRow && lastRow.repoRev) {
          cursor = {
            cid: CID.parse(lastRow.cid),
            rev: lastRow.repoRev,
          }
        } else {
          cursor = undefined
        }
      } while (cursor)
      // ensure we flush the last page of blocks
      await writePromise
    })
  }

  async getBlockRange(since?: string, cursor?: RevCursor) {
    const { ref } = this.db.db.dynamic
    let builder = this.db.db
      .selectFrom('ipld_block')
      .select(['cid', 'repoRev', 'content'])
      .orderBy('repoRev', 'desc')
      .orderBy('cid', 'desc')
      .limit(500)
    if (cursor) {
      // use this syntax to ensure we hit the index
      builder = builder.where(
        sql`((${ref('repoRev')}, ${ref('cid')}) < (${
          cursor.rev
        }, ${cursor.cid.toString()}))`,
      )
    }
    if (since) {
      builder = builder.where('repoRev', '>', since)
    }
    return builder.execute()
  }

  getTimestamp(): string {
    return this.timestamp || new Date().toISOString()
  }

  async destroy(): Promise<void> {
    throw new Error('Destruction of SQL repo storage not allowed at runtime')
  }
}

type RevCursor = {
  cid: CID
  rev: string
}

export default SqlRepoStorage

export class RepoRootNotFoundError extends Error {}
