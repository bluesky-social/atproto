import { chunkArray } from '@atproto/common'
import { BlockMap, MemoryBlockstore } from '@atproto/repo'
import { Kysely } from 'kysely'
import { CID } from 'multiformats/cid'
import { RepoCommitBlock } from '../tables/repo-commit-block'
import { RepoCommitHistory } from '../tables/repo-commit-history'

const commitBlockTable = 'repo_commit_block'
const commitHistoryTable = 'repo_commit_history'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable(commitBlockTable)
    .addColumn('commit', 'varchar', (col) => col.notNull())
    .addColumn('block', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint(`${commitBlockTable}_pkey`, [
      'creator',
      'commit',
      'block',
    ])
    .execute()
  await db.schema
    .createTable(commitHistoryTable)
    .addColumn('commit', 'varchar', (col) => col.notNull())
    .addColumn('prev', 'varchar')
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint(`${commitHistoryTable}_pkey`, [
      'creator',
      'commit',
    ])
    .execute()

  const migrateUser = async (did: string, root: CID) => {
    const userBlocks = await db
      .selectFrom('ipld_block')
      .innerJoin(
        'ipld_block_creator as creator',
        'creator.cid',
        'ipld_block.cid',
      )
      .where('creator.did', '=', did)
      .select(['ipld_block.cid as cid', 'ipld_block.content as content'])
      .execute()

    const blocks = new BlockMap()
    userBlocks.forEach((row) => {
      blocks.set(CID.parse(row.cid), row.content)
    })

    const storage = new MigrationStorage(blocks, db)

    const commitData = await storage.getCommits(root, null)
    if (!commitData) return

    const commitBlock: RepoCommitBlock[] = []
    const commitHistory: RepoCommitHistory[] = []

    for (let i = 0; i < commitData.length; i++) {
      const commit = commitData[i]
      const prev = commitData[i - 1]
      commit.blocks.forEach((_bytes, cid) => {
        commitBlock.push({
          commit: commit.commit.toString(),
          block: cid.toString(),
          creator: did,
        })
      })
      commitHistory.push({
        commit: commit.commit.toString(),
        prev: prev ? prev.commit.toString() : null,
        creator: did,
      })
    }
    const promises: Promise<unknown>[] = []
    chunkArray(commitBlock, 500).forEach((batch) => {
      promises.push(
        db
          .insertInto('repo_commit_block')
          .values(batch)
          .onConflict((oc) => oc.doNothing())
          .execute(),
      )
    })
    chunkArray(commitHistory, 500).forEach((batch) => {
      promises.push(
        db
          .insertInto('repo_commit_history')
          .values(batch)
          .onConflict((oc) => oc.doNothing())
          .execute(),
      )
    })

    const ipldBlockCreators = storage.blocks.entries().map((entry) => ({
      cid: entry.cid.toString(),
      did: did,
    }))
    chunkArray(ipldBlockCreators, 500).forEach((batch) => {
      promises.push(
        db
          .insertInto('ipld_block_creator')
          .values(batch)
          .onConflict((oc) => oc.doNothing())
          .execute(),
      )
    })

    return Promise.all(promises)
  }

  const userRoots = await db.selectFrom('repo_root').selectAll().execute()

  await Promise.all(
    userRoots.map((row) => migrateUser(row.did, CID.parse(row.root))),
  )
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable(commitHistoryTable).execute()
  await db.schema.dropTable(commitBlockTable).execute()
}

class MigrationStorage extends MemoryBlockstore {
  constructor(public blocks: BlockMap, public db: Kysely<any>) {
    super()
  }

  async getBytes(cid: CID): Promise<Uint8Array | null> {
    const got = this.blocks.get(cid)
    if (got) return got
    const fromDb = await this.db
      .selectFrom('ipld_block')
      .where('cid', '=', cid.toString())
      .selectAll()
      .executeTakeFirst()
    if (!fromDb) return null
    this.blocks.set(cid, fromDb.content)
    return fromDb.content
  }

  async has(cid: CID): Promise<boolean> {
    const got = await this.getBytes(cid)
    return !!got
  }

  async getBlocks(cids: CID[]): Promise<{ blocks: BlockMap; missing: CID[] }> {
    const got = this.blocks.getMany(cids)
    if (got.missing.length === 0) return got
    const fromDb = await this.db
      .selectFrom('ipld_block')
      .where(
        'cid',
        'in',
        got.missing.map((c) => c.toString()),
      )
      .selectAll()
      .execute()
    fromDb.forEach((row) => {
      this.blocks.set(CID.parse(row.cid), row.content)
    })
    return this.blocks.getMany(cids)
  }
}
