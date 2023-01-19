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

  const getHistory = () => {
    return db.db
      .selectFrom('repo_commit_history')
      .selectAll()
      .orderBy('commit')
      .orderBy('prev')
      .execute()
  }

  const getBlocks = () => {
    return db.db
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
    const migration = await db.migrator.migrateDown()
    expect(migration.error).toBeUndefined()
    await expect(getHistory()).rejects.toThrow()
    await expect(getBlocks()).rejects.toThrow()
  })

  it('migrates up', async () => {
    const migration = await db.migrator.migrateUp()
    expect(migration.error).toBeUndefined()
    const migratedHistory = await getHistory()
    const migratedBlocks = await getBlocks()
    expect(migratedHistory).toEqual(history)
    expect(migratedBlocks).toEqual(blocks)
  })
})
