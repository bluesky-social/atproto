import { MemoryBlockstore, Repo } from '@atproto/repo'
import BlockMap from '@atproto/repo/src/block-map'
import fs from 'fs/promises'
import { CID } from 'multiformats/cid'
import { Database } from '../../../src'
import SqlRepoStorage from '../../../src/sql-repo-storage'

type TestData = {
  repoData: Record<string, Record<string, unknown>>
  commitPath: string[]
}

describe('repo sync data migration', () => {
  let db: Database
  const did = 'did:key:zDnaegoVtoy9Na3arc4QAu7Su2ZCaNQVsZNqqnCR8fjVgBrFQ'
  let data: TestData

  beforeAll(async () => {
    await fs.copyFile(
      'tests/migrations/repo-sync-data/pre-migration.sqlite',
      'tests/migrations/repo-sync-data/test.sqlite',
    )
    db = Database.sqlite('tests/migrations/repo-sync-data/test.sqlite')
    await db.migrator.migrateTo('_20230118T223059239Z')
    const readData = await fs.readFile(
      'tests/migrations/repo-sync-data/expected-data.json',
    )
    if (!readData) {
      throw new Error('could not read test data')
    }
    data = JSON.parse(readData.toString())
  })

  afterAll(async () => {
    await db.close()
    await fs.rm('tests/migrations/repo-sync-data/test.sqlite')
  })

  it('migrated correctly', async () => {
    const storage = new SqlRepoStorage(db, did)
    const root = await storage.getHead()
    if (!root) {
      throw new Error('could not get repo root')
    }
    const commitLog = await storage.getCommitPath(root, null)
    if (!commitLog) {
      throw new Error('could not get commit log')
    }
    const commitLogStr = commitLog.map((cid) => cid.toString())
    expect(commitLogStr).toEqual(data.commitPath)

    const res = await db.db
      .selectFrom('repo_commit_block')
      .innerJoin('ipld_block', 'ipld_block.cid', 'repo_commit_block.block')
      .where('repo_commit_block.commit', 'in', commitLogStr)
      .select(['ipld_block.cid as cid', 'ipld_block.content as content'])
      .execute()
    const blockmap = new BlockMap()
    res.forEach((row) => {
      blockmap.set(CID.parse(row.cid), row.content)
    })
    const blockstore = new MemoryBlockstore()
    blockstore.putMany(blockmap)
    const repo = await Repo.load(blockstore, root)
    for (const collName of Object.keys(data.repoData)) {
      const collData = data.repoData[collName]
      for (const rkey of Object.keys(collData)) {
        const record = await repo.getRecord(collName, rkey)
        expect(record).toEqual(collData[rkey])
      }
    }
  })
})
