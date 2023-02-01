import { CommitData, RepoStorage, BlockMap, CidSet } from '@atproto/repo'
import { chunkArray } from '@atproto/common'
import { CID } from 'multiformats/cid'
import Database from './db'
import { IpldBlock } from './db/tables/ipld-block'
import { IpldBlockCreator } from './db/tables/ipld-block-creator'
import { RepoCommitBlock } from './db/tables/repo-commit-block'
import { RepoCommitHistory } from './db/tables/repo-commit-history'

export class SqlRepoStorage extends RepoStorage {
  cache: BlockMap = new BlockMap()

  constructor(
    public db: Database,
    public did: string,
    public timestamp?: string,
  ) {
    super()
  }

  async getHead(forUpdate?: boolean): Promise<CID | null> {
    // if for update, we lock the row
    let builder = this.db.db
      .selectFrom('repo_root')
      .selectAll()
      .where('did', '=', this.did)
    if (forUpdate && this.db.dialect !== 'sqlite') {
      // SELECT FOR UPDATE is not supported by sqlite, but sqlite txs are SERIALIZABLE so we don't actually need it
      builder = builder.forUpdate()
    }
    const found = await builder.executeTakeFirst()
    if (!found) return null

    // if for update, we cache the blocks from last commit
    // this must be split out into a separate query because of how pg handles SELECT FOR UPDATE with outer joins
    if (forUpdate) {
      const res = await this.db.db
        .selectFrom('repo_commit_block')
        .leftJoin('ipld_block', 'ipld_block.cid', 'repo_commit_block.block')
        .where('repo_commit_block.commit', '=', found.root)
        .where('repo_commit_block.creator', '=', this.did)
        .select([
          'ipld_block.cid as blockCid',
          'ipld_block.content as blockBytes',
        ])
        .execute()
      res.forEach((row) => {
        if (row.blockCid && row.blockBytes) {
          this.cache.set(CID.parse(row.blockCid), row.blockBytes)
        }
      })
    }

    return CID.parse(found.root)
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
          .innerJoin(
            'ipld_block_creator as creator',
            'creator.cid',
            'ipld_block.cid',
          )
          .where('creator.did', '=', this.did)
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

  async putBlock(cid: CID, block: Uint8Array): Promise<void> {
    this.db.assertTransaction()
    const insertBlock = this.db.db
      .insertInto('ipld_block')
      .values({
        cid: cid.toString(),
        size: block.length,
        content: block,
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
      })
      creators.push({
        cid: cid.toString(),
        did: this.did,
      })
    })
    const putBlocks = Promise.all(
      chunkArray(blocks, 500).map((batch) =>
        this.db.db
          .insertInto('ipld_block')
          .values(batch)
          .onConflict((oc) => oc.doNothing())
          .execute(),
      ),
    )
    const putCreators = Promise.all(
      chunkArray(creators, 500).map((batch) =>
        this.db.db
          .insertInto('ipld_block_creator')
          .values(batch)
          .onConflict((oc) => oc.doNothing())
          .execute(),
      ),
    )
    await Promise.all([putBlocks, putCreators])
  }

  async indexCommits(commits: CommitData[]): Promise<void> {
    this.db.assertTransaction()
    const allBlocks = new BlockMap()
    const commitBlocks: RepoCommitBlock[] = []
    const commitHistory: RepoCommitHistory[] = []
    for (const commit of commits) {
      for (const block of commit.blocks.entries()) {
        commitBlocks.push({
          commit: commit.commit.toString(),
          block: block.cid.toString(),
          creator: this.did,
        })
        allBlocks.set(block.cid, block.bytes)
      }
      commitHistory.push({
        commit: commit.commit.toString(),
        prev: commit.prev ? commit.prev.toString() : null,
        creator: this.did,
      })
    }
    const insertCommitBlocks = Promise.all(
      chunkArray(commitBlocks, 500).map((batch) =>
        this.db.db
          .insertInto('repo_commit_block')
          .values(batch)
          .onConflict((oc) => oc.doNothing())
          .execute(),
      ),
    )
    const insertCommitHistory = Promise.all(
      chunkArray(commitHistory, 500).map((batch) =>
        this.db.db
          .insertInto('repo_commit_history')
          .values(batch)
          .onConflict((oc) => oc.doNothing())
          .execute(),
      ),
    )
    await Promise.all([
      this.putMany(allBlocks),
      insertCommitBlocks,
      insertCommitHistory,
    ])
  }

  async updateHead(cid: CID, prev: CID | null): Promise<void> {
    if (prev === null) {
      await this.db.db
        .insertInto('repo_root')
        .values({
          did: this.did,
          root: cid.toString(),
          indexedAt: this.getTimestamp(),
        })
        .execute()
    } else {
      const res = await this.db.db
        .updateTable('repo_root')
        .set({
          root: cid.toString(),
          indexedAt: this.getTimestamp(),
        })
        .where('did', '=', this.did)
        .where('root', '=', prev.toString())
        .executeTakeFirst()
      if (res.numUpdatedRows < 1) {
        throw new Error('failed to update repo root: misordered')
      }
    }
  }

  private getTimestamp(): string {
    return this.timestamp || new Date().toISOString()
  }

  async getCommitPath(
    latest: CID,
    earliest: CID | null,
  ): Promise<CID[] | null> {
    throw new Error('commit operations temporarily disabled')
    // const res = await this.db.db
    //   .withRecursive('ancestor(commit, prev)', (cte) =>
    //     cte
    //       .selectFrom('repo_commit_history as commit')
    //       .select(['commit.commit as commit', 'commit.prev as prev'])
    //       .where('commit', '=', latest.toString())
    //       .where('creator', '=', this.did)
    //       .unionAll(
    //         cte
    //           .selectFrom('repo_commit_history as commit')
    //           .select(['commit.commit as commit', 'commit.prev as prev'])
    //           .innerJoin('ancestor', (join) =>
    //             join
    //               .onRef('ancestor.prev', '=', 'commit.commit')
    //               .on('commit.creator', '=', this.did),
    //           )
    //           .if(earliest !== null, (qb) =>
    //             // @ts-ignore
    //             qb.where('commit.commit', '!=', earliest?.toString() as string),
    //           ),
    //       ),
    //   )
    //   .selectFrom('ancestor')
    //   .select('commit')
    //   .execute()
    // return res.map((row) => CID.parse(row.commit)).reverse()
  }
  async getBlocksForCommits(
    commits: CID[],
  ): Promise<{ [commit: string]: BlockMap }> {
    throw new Error('commit operations temporarily disabled')
    // if (commits.length === 0) return {}
    // const commitStrs = commits.map((commit) => commit.toString())
    // const res = await this.db.db
    //   .selectFrom('repo_commit_block')
    //   .where('repo_commit_block.creator', '=', this.did)
    //   .where('repo_commit_block.commit', 'in', commitStrs)
    //   .innerJoin('ipld_block', 'ipld_block.cid', 'repo_commit_block.block')
    //   .select([
    //     'repo_commit_block.commit',
    //     'ipld_block.cid',
    //     'ipld_block.content',
    //   ])
    //   .execute()
    // return res.reduce((acc, cur) => {
    //   acc[cur.commit] ??= new BlockMap()
    //   const cid = CID.parse(cur.cid)
    //   acc[cur.commit].set(cid, cur.content)
    //   this.cache.set(cid, cur.content)
    //   return acc
    // }, {})
  }

  async destroy(): Promise<void> {
    throw new Error('Destruction of SQL repo storage not allowed at runtime')
  }
}

export default SqlRepoStorage
