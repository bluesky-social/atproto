import AtpApi from '@atproto/api'
import { Database } from '../../src'
import { SeedClient } from '../seeds/client'
import { CloseFn, runTestServer } from '../_util'
import basicSeed from '../seeds/basic'
import { RepoCommitHistory } from '../../src/db/tables/repo-commit-history'
import { RepoCommitBlock } from '../../src/db/tables/repo-commit-block'

describe('repo sync data migration', () => {
  let close: CloseFn
  let db: Database

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'migration_repo_sync',
    })
    close = server.close
    db = server.ctx.db
    const client = AtpApi.service(server.url)
    const sc = new SeedClient(client)
    await basicSeed(sc, server.ctx.messageQueue)
  })

  afterAll(async () => {
    await close()
  })

  const getHistory = async () => {
    return await db.db
      .selectFrom('repo_commit_history')
      .selectAll()
      .orderBy('commit')
      .orderBy('prev')
      .execute()
  }

  const getBlocks = async () => {
    return await db.db
      .selectFrom('repo_commit_block')
      .selectAll()
      .orderBy('commit')
      .orderBy('block')
      .execute()
  }

  let history: RepoCommitHistory[]
  let blocks: RepoCommitBlock[]

  it('fetches the current state of the tables', async () => {
    history = await getHistory()
    blocks = await getBlocks()
  })

  it('migrates down', async () => {
    const migration = await db.migrator.migrateTo('_20230127T215753149Z')
    expect(migration.error).toBeUndefined()
    // normal syntax for async exceptions as not catching the error for some reason
    let err1
    try {
      await getHistory()
    } catch (e) {
      err1 = e
    }
    expect(err1).toBeDefined()
    let err2
    try {
      await getHistory()
    } catch (e) {
      err2 = e
    }
    expect(err2).toBeDefined()
  })

  it('migrates up', async () => {
    const migration = await db.migrator.migrateTo('_20230127T224743452Z')
    expect(migration.error).toBeUndefined()
    const migratedHistory = await getHistory()
    const migratedBlocks = await getBlocks()
    expect(migratedHistory).toEqual(history)
    expect(migratedBlocks).toEqual(blocks)
  })
})
