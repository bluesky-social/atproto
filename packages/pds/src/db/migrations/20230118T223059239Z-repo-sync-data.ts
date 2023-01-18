import { chunkArray } from '@atproto/common'
import { MemoryBlockstore } from '@atproto/repo'
import { Kysely } from 'kysely'
import { CID } from 'multiformats/cid'
import DatabaseSchema from '../database-schema'
import { RepoCommitBlock } from '../tables/repo-commit-block'
import { RepoCommitHistory } from '../tables/repo-commit-history'

const commitBlockTable = 'repo_commit_block'
const commitHistoryTable = 'repo_commit_history'

export async function up(db: DatabaseSchema): Promise<void> {
  await db.schema
    .createTable(commitBlockTable)
    .addColumn('commit', 'varchar', (col) => col.notNull())
    .addColumn('block', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint(`${commitBlockTable}_pkey`, ['commit', 'block'])
    .execute()
  await db.schema
    .createTable(commitHistoryTable)
    .addColumn('commit', 'varchar', (col) => col.notNull())
    .addColumn('prev', 'varchar')
    .addPrimaryKeyConstraint(`${commitHistoryTable}_pkey`, ['commit', 'prev'])
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
    const storage = new MemoryBlockstore()
    userBlocks.forEach((row) => {
      storage.putBlock(CID.parse(row.cid), row.content)
    })

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
        })
      })
      commitHistory.push({
        commit: commit.commit.toString(),
        prev: prev ? prev.commit.toString() : null,
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
