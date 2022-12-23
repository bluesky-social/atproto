import { chunkArray } from '@atproto/common'
import { RepoStorage } from '@atproto/repo'
import { CID } from 'multiformats/cid'
import Database from './db'
import { IpldBlock } from './db/tables/ipld-block'
import { IpldBlockCreator } from './db/tables/ipld-block-creator'
import { RepoCommitBlock } from './db/tables/repo-commit-block'

export class SqlRepoStorage extends RepoStorage {
  constructor(
    public db: Database,
    public did: string,
    public timestamp?: string,
  ) {
    super()
  }

  async getHead(forUpdate?: boolean): Promise<CID | null> {
    let builder = this.db.db
      .selectFrom('repo_root')
      .selectAll()
      .where('did', '=', this.did)
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

  async getSavedBytes(cid: CID): Promise<Uint8Array | null> {
    const found = await this.db.db
      .selectFrom('ipld_block')
      .innerJoin(
        'ipld_block_creator as creator',
        'creator.cid',
        'ipld_block.cid',
      )
      .where('creator.did', '=', this.did)
      .where('cid', '=', cid.toString())
      .select('content')
      .executeTakeFirst()
    return found ? found.content : null
  }

  async hasSavedBlock(cid: CID): Promise<boolean> {
    const found = await this.getSavedBytes(cid)
    return !!found
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
  }

  async putMany(toPut: Map<string, Uint8Array>): Promise<void> {
    this.db.assertTransaction()
    const blocks: IpldBlock[] = []
    const creators: IpldBlockCreator[] = []
    for (const staged of toPut.entries()) {
      const [cid, bytes] = staged
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
    }
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

  async commitStaged(commit: CID, prev: CID | null): Promise<void> {
    this.db.assertTransaction()
    const commitBlocks: RepoCommitBlock[] = []
    this.staged.forEach((_bytes, cid) => {
      commitBlocks.push({
        commit: commit.toString(),
        block: cid.toString(),
      })
    })
    const insertBlocks = this.putMany(this.staged)
    const insertCommit = this.db.db
      .insertInto('repo_commit_block')
      .values(commitBlocks)
      .onConflict((oc) => oc.doNothing())
      .execute()
    const updateRoot =
      prev === null ? this.insertRoot(commit) : this.updateRoot(commit, prev)
    const insertCommitHistory = this.db.db
      .insertInto('repo_commit_history')
      .values({
        commit: commit.toString(),
        prev: prev ? prev.toString() : null,
      })
      .onConflict((oc) => oc.doNothing())
      .execute()
    await Promise.all([
      insertBlocks,
      insertCommit,
      updateRoot,
      insertCommitHistory,
    ])
    this.clearStaged()
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

  async destroySaved(): Promise<void> {
    throw new Error('Destruction of SQL repo storage not allowed at runtime')
  }
}

export default SqlRepoStorage
