import { chunkArray } from '@atproto/common'
import { BlockMap, MemoryBlockstore } from '@atproto/repo'
import { Kysely } from 'kysely'
import { CID } from 'multiformats/cid'
import { RepoCommitBlock } from '../tables/repo-commit-block'
import { RepoCommitHistory } from '../tables/repo-commit-history'

export async function up(db: Kysely<any>): Promise<void> {
  const migrateUser = async (did: string, head: CID, start: CID | null) => {
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

    const commitData = await storage.getCommits(head, start)
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
    const ipldBlockCreators = storage.blocks.entries().map((entry) => ({
      cid: entry.cid.toString(),
      did: did,
    }))

    const createRepoCommitBlocks = async () => {
      for (const batch of chunkArray(commitBlock, 500)) {
        await db
          .insertInto('repo_commit_block')
          .values(batch)
          .onConflict((oc) => oc.doNothing())
          .execute()
      }
    }
    const createRepoCommitHistory = async () => {
      for (const batch of chunkArray(commitHistory, 500)) {
        await db
          .insertInto('repo_commit_history')
          .values(batch)
          .onConflict((oc) => oc.doNothing())
          .execute()
      }
    }
    const createIpldBlockCreators = async () => {
      for (const batch of chunkArray(ipldBlockCreators, 500)) {
        await db
          .insertInto('ipld_block_creator')
          .values(batch)
          .onConflict((oc) => oc.doNothing())
          .execute()
      }
    }

    await Promise.all([
      createRepoCommitBlocks(),
      createRepoCommitHistory(),
      createIpldBlockCreators(),
    ])
  }

  const repoHeads = await db.selectFrom('repo_root').selectAll().execute()
  const currHeads: Record<string, CID> = {}
  for (const row of repoHeads) {
    const head = CID.parse(row.root)
    await migrateUser(row.did, head, null)
    currHeads[row.did] = head
  }
}

export async function down(_db: Kysely<unknown>): Promise<void> {}

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
