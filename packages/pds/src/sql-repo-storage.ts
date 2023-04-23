import {
  CommitData,
  RepoStorage,
  BlockMap,
  CidSet,
  RebaseData,
  CommitCidData,
} from '@atproto/repo'
import { chunkArray } from '@atproto/common'
import { CID } from 'multiformats/cid'
import Database from './db'
import { valuesList } from './db/util'
import { IpldBlock } from './db/tables/ipld-block'
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

  // note this method will return null if the repo has a lock on it currently
  async lockHead(): Promise<CID | null> {
    let builder = this.db.db
      .selectFrom('repo_root')
      .selectAll()
      .where('did', '=', this.did)
    if (this.db.dialect !== 'sqlite') {
      builder = builder.forUpdate().skipLocked()
    }
    const res = await builder.executeTakeFirst()
    if (!res) return null
    return CID.parse(res.root)
  }

  async getHead(): Promise<CID | null> {
    const res = await this.db.db
      .selectFrom('repo_root')
      .selectAll()
      .where('did', '=', this.did)
      .executeTakeFirst()
    if (!res) return null
    return CID.parse(res.root)
  }

  async getBytes(cid: CID): Promise<Uint8Array | null> {
    const cached = this.cache.get(cid)
    if (cached) return cached
    const found = await this.db.db
      .selectFrom('ipld_block')
      .where('ipld_block.creator', '=', this.did)
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
          .where('ipld_block.creator', '=', this.did)
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
    await this.db.db
      .insertInto('ipld_block')
      .values({
        cid: cid.toString(),
        creator: this.did,
        size: block.length,
        content: block,
      })
      .onConflict((oc) => oc.doNothing())
      .execute()
    this.cache.set(cid, block)
  }

  async putMany(toPut: BlockMap): Promise<void> {
    this.db.assertTransaction()
    const blocks: IpldBlock[] = []
    toPut.forEach((bytes, cid) => {
      blocks.push({
        cid: cid.toString(),
        creator: this.did,
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

  async applyRebase(rebase: RebaseData): Promise<void> {
    this.db.assertTransaction()
    await Promise.all([
      this.db.db
        .deleteFrom('repo_commit_block')
        .where('creator', '=', this.did)
        .execute(),
      this.db.db
        .deleteFrom('repo_commit_history')
        .where('creator', '=', this.did)
        .execute(),
      this.putMany(rebase.blocks),
    ])

    const allCids = [...rebase.preservedCids, ...rebase.blocks.cids()]
    await this.indexCommitCids([
      { commit: rebase.commit, prev: null, cids: allCids },
    ])
    await this.db.db
      .deleteFrom('ipld_block')
      .where('ipld_block.creator', '=', this.did)
      .where(
        'cid',
        'in',
        this.db.db
          .selectFrom('ipld_block as block')
          .leftJoin('repo_commit_block', (join) =>
            join
              .onRef('block.creator', '=', 'repo_commit_block.creator')
              .onRef('block.cid', '=', 'repo_commit_block.block'),
          )
          .where('repo_commit_block.creator', 'is', null)
          .select('block.cid'),
      )
      .execute()
    await this.updateHead(rebase.commit, null)
  }

  async indexCommits(commits: CommitData[]): Promise<void> {
    this.db.assertTransaction()
    const allBlocks = new BlockMap()
    const cidData: CommitCidData[] = []
    for (const commit of commits) {
      const commitCids: CID[] = []
      for (const block of commit.blocks.entries()) {
        commitCids.push(block.cid)
        allBlocks.set(block.cid, block.bytes)
      }
      cidData.push({
        commit: commit.commit,
        prev: commit.prev,
        cids: commitCids,
      })
    }
    await Promise.all([this.putMany(allBlocks), this.indexCommitCids(cidData)])
  }

  async indexCommitCids(commits: CommitCidData[]): Promise<void> {
    this.db.assertTransaction()
    const commitBlocks: RepoCommitBlock[] = []
    const commitHistory: RepoCommitHistory[] = []
    for (const commit of commits) {
      for (const cid of commit.cids) {
        commitBlocks.push({
          commit: commit.commit.toString(),
          block: cid.toString(),
          creator: this.did,
        })
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
    await Promise.all([insertCommitBlocks, insertCommitHistory])
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
        .onConflict((oc) =>
          oc.column('did').doUpdateSet({ root: cid.toString() }),
        )
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
    const res = await this.db.db
      .withRecursive('ancestor(commit, prev)', (cte) =>
        cte
          .selectFrom('repo_commit_history as commit')
          .select(['commit.commit as commit', 'commit.prev as prev'])
          .where('commit', '=', latest.toString())
          .where('creator', '=', this.did)
          .unionAll(
            cte
              .selectFrom('repo_commit_history as commit')
              .select(['commit.commit as commit', 'commit.prev as prev'])
              .innerJoin('ancestor', (join) =>
                join
                  .onRef('ancestor.prev', '=', 'commit.commit')
                  .on('commit.creator', '=', this.did),
              )
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

  async getAllBlocksForCommits(commits: CID[]): Promise<BlockForCommit[]> {
    if (commits.length === 0) return []
    const commitStrs = commits.map((commit) => commit.toString())
    const res = await this.db.db
      .selectFrom('repo_commit_block')
      .where('repo_commit_block.creator', '=', this.did)
      .whereRef('repo_commit_block.commit', 'in', valuesList(commitStrs))
      .innerJoin('ipld_block', (join) =>
        join
          .onRef('ipld_block.cid', '=', 'repo_commit_block.block')
          .onRef('ipld_block.creator', '=', 'repo_commit_block.creator'),
      )
      .select([
        'repo_commit_block.commit',
        'ipld_block.cid',
        'ipld_block.content',
      ])
      .execute()
    return res.map((row) => ({
      cid: CID.parse(row.cid),
      bytes: row.content,
      commit: row.commit,
    }))
  }

  async getBlocksForCommits(
    commits: CID[],
  ): Promise<{ [commit: string]: BlockMap }> {
    const allBlocks = await this.getAllBlocksForCommits(commits)
    return allBlocks.reduce((acc, cur) => {
      acc[cur.commit] ??= new BlockMap()
      acc[cur.commit].set(cur.cid, cur.bytes)
      this.cache.set(cur.cid, cur.bytes)
      return acc
    }, {})
  }

  async destroy(): Promise<void> {
    throw new Error('Destruction of SQL repo storage not allowed at runtime')
  }
}

type BlockForCommit = {
  cid: CID
  bytes: Uint8Array
  commit: string
}

export default SqlRepoStorage
