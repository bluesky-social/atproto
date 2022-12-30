import { CommitData, RepoStorage } from '@atproto/repo'
import BlockMap from '@atproto/repo/src/block-map'
import { chunkArray } from '@atproto/common'
import { CID } from 'multiformats/cid'
import Database from './db'
import { IpldBlock } from './db/tables/ipld-block'
import { IpldBlockCreator } from './db/tables/ipld-block-creator'

export class SqlRepoStorage implements RepoStorage {
  cache: BlockMap = new BlockMap()
  constructor(
    public db: Database,
    public did: string,
    public timestamp?: string,
  ) {}

  async getHead(forUpdate?: boolean): Promise<CID | null> {
    // if for update, we lock the row & cache the last commit
    if (forUpdate) {
      this.db.assertTransaction()
      let builder = this.db.db
        .selectFrom('repo_root')
        .leftJoin(
          'repo_commit_block',
          'repo_commit_block.commit',
          'repo_commit_block.block',
        )
        .leftJoin('ipld_block', 'ipld_block.cid', 'repo_commit_block.block')
        .select([
          'repo_root.root as root',
          'ipld_block.cid as blockCid',
          'ipld_block.content as blockBytes',
        ])
        .where('did', '=', this.did)
      if (this.db.dialect !== 'sqlite') {
        // SELECT FOR UPDATE is not supported by sqlite, but sqlite txs are SERIALIZABLE so we don't actually need it
        builder = builder.forUpdate()
      }
      const res = await builder.execute()
      res.forEach((row) => {
        if (row.blockCid && row.blockBytes) {
          this.cache.set(CID.parse(row.blockCid), row.blockBytes)
        }
      })
      return res.length > 0 ? CID.parse(res[0].root) : null
    } else {
      const found = await this.db.db
        .selectFrom('repo_root')
        .selectAll()
        .where('did', '=', this.did)
        .executeTakeFirst()
      return found ? CID.parse(found.root) : null
    }
  }

  async getBytes(cid: CID): Promise<Uint8Array | null> {
    const cached = this.cache.get(cid)
    if (cached) return cached
    const found = await this.db.db
      .selectFrom('ipld_block')
      .innerJoin(
        'ipld_block_creator as creator',
        'creator.cid',
        'ipld_block.cid',
      )
      .where('creator.did', '=', this.did)
      .where('ipld_block.cid', '=', cid.toString())
      .select('content')
      .executeTakeFirst()
    if (!found) return null
    this.cache.set(cid, found.content)
    return found.content
  }

  async hasSavedBytes(cid: CID): Promise<boolean> {
    const got = await this.getSavedBytes(cid)
    return !!got
  }

  async getManySavedBytes(cids: CID[]): Promise<BlockMap> {
    const blocks = new BlockMap()
    const toCheckDb: string[] = []
    for (const cid of cids) {
      const cached = this.cache.get(cid)
      if (cached) {
        blocks.set(cid, cached)
      } else {
        toCheckDb.push(cid.toString())
      }
    }
    if (toCheckDb.length < 1) return blocks
    const res = await this.db.db
      .selectFrom('ipld_block')
      .innerJoin(
        'ipld_block_creator as creator',
        'creator.cid',
        'ipld_block.cid',
      )
      .where('creator.did', '=', this.did)
      .where('ipld_block.cid', 'in', toCheckDb)
      .select(['ipld_block.cid as cid', 'ipld_block.content as content'])
      .execute()
    for (const row of res) {
      const cid = CID.parse(row.cid)
      this.cache.set(cid, row.content)
      blocks.set(cid, row.content)
    }
    return blocks
  }

  async putBlock(cid: CID, block: Uint8Array): Promise<void> {
    this.db.assertTransaction()
    const insertBlock = this.db.db
      .insertInto('ipld_block')
      .values({
        cid: cid.toString(),
        size: block.length,
        content: block,
        indexedAt: this.timestamp || new Date().toISOString(),
      })
      .onConflict((oc) => oc.doNothing())
      .execute()
    const insertCreator = this.db.db
      .insertInto('ipld_block_creator')
      .values({
        cid: cid.toString(),
        did: this.did,
      })
      .onConflict((oc) => oc.doNothing())
      .execute()
    await Promise.all([insertBlock, insertCreator])
    this.cache.set(cid, block)
  }

  async putMany(toPut: BlockMap): Promise<void> {
    this.db.assertTransaction()
    const blocks: IpldBlock[] = []
    const creators: IpldBlockCreator[] = []
    toPut.forEach((bytes, cid) => {
      blocks.push({
        cid: cid.toString(),
        size: bytes.length,
        content: bytes,
        indexedAt: this.timestamp || new Date().toISOString(),
      })
      creators.push({
        cid: cid.toString(),
        did: this.did,
      })
    })
    const promises: Promise<unknown>[] = []
    chunkArray(blocks, 500).forEach((batch) => {
      const promise = this.db.db
        .insertInto('ipld_block')
        .values(batch)
        .onConflict((oc) => oc.doNothing())
        .execute()
      promises.push(promise)
    })
    chunkArray(creators, 500).forEach((batch) => {
      const promise = this.db.db
        .insertInto('ipld_block_creator')
        .values(batch)
        .onConflict((oc) => oc.doNothing())
        .execute()
      promises.push(promise)
    })
    await Promise.all(promises)
  }

  async applyCommit(commit: CommitData): Promise<void> {
    this.db.assertTransaction()
    const commitBlocks = commit.blocks.entries().map((block) => ({
      commit: commit.root.toString(),
      block: block.cid.toString(),
    }))
    const insertBlocks = this.putMany(commit.blocks)
    const insertCommit = this.db.db
      .insertInto('repo_commit_block')
      .values(commitBlocks)
      .onConflict((oc) => oc.doNothing())
      .execute()
    const updateRoot =
      commit.prev === null
        ? this.insertRoot(commit.root)
        : this.updateRoot(commit.root, commit.prev)
    const insertCommitHistory = this.db.db
      .insertInto('repo_commit_history')
      .values({
        commit: commit.root.toString(),
        prev: commit.prev ? commit.prev.toString() : null,
      })
      .onConflict((oc) => oc.doNothing())
      .execute()
    await Promise.all([
      insertBlocks,
      insertCommit,
      updateRoot,
      insertCommitHistory,
    ])
  }

  private async insertRoot(commit: CID): Promise<void> {
    await this.db.db
      .insertInto('repo_root')
      .values({
        did: this.did,
        root: commit.toString(),
        indexedAt: this.getTimestamp(),
      })
      .execute()
  }

  private async updateRoot(commit: CID, prev: CID): Promise<void> {
    const res = await this.db.db
      .updateTable('repo_root')
      .set({
        root: commit.toString(),
        indexedAt: this.getTimestamp(),
      })
      .where('did', '=', this.did)
      .where('root', '=', prev.toString())
      .executeTakeFirst()
    if (res.numUpdatedRows < 1) {
      throw new Error('failed to update repo root: misordered')
    }
  }

  private getTimestamp(): string {
    return this.timestamp || new Date().toISOString()
  }

  async getCommitPath(
    latest: CID,
    earliest: CID | null,
  ): Promise<CID[] | null> {
    const res = await this.db.db
      .withRecursive('ancestor(commit, prev)', (cte) =>
        cte
          .selectFrom('repo_commit_history as commit')
          .select(['commit.commit as commit', 'commit.prev as prev'])
          .where('commit', '=', latest.toString())
          .unionAll(
            cte
              .selectFrom('repo_commit_history as commit')
              .select(['commit.commit as commit', 'commit.prev as prev'])
              .innerJoin('ancestor', 'ancestor.prev', 'commit.commit')
              .if(earliest !== null, (qb) =>
                // @ts-ignore
                qb.where('commit.commit', '!=', earliest?.toString() as string),
              ),
          ),
      )
      .selectFrom('ancestor')
      .select('commit')
      .execute()
    return res.map((row) => CID.parse(row.commit)).reverse()
  }
  async getBlocksForCommits(
    commits: CID[],
  ): Promise<{ [commit: string]: BlockMap }> {
    if (commits.length === 0) return {}
    const commitStrs = commits.map((commit) => commit.toString())
    const res = await this.db.db
      .selectFrom('repo_commit_block')
      .innerJoin('ipld_block', 'ipld_block.cid', 'repo_commit_block.block')
      .select([
        'repo_commit_block.commit',
        'ipld_block.cid',
        'ipld_block.content',
      ])
      .where('commit', 'in', commitStrs)
      .execute()
    return res.reduce((acc, cur) => {
      if (!acc[cur.commit]) {
        acc[cur.commit] = new BlockMap()
      }
      const cid = CID.parse(cur.cid)
      acc[cur.commit].set(cid, cur.content)
      this.cache.set(cid, cur.content)
      return acc
    }, {})
  }

  async destroy(): Promise<void> {
    throw new Error('Destruction of SQL repo storage not allowed at runtime')
  }
}

export default SqlRepoStorage
