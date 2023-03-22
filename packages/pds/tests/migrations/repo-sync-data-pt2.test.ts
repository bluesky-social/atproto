import AtpAgent from '@atproto/api'
import { Database } from '../../src'
import { Kysely } from 'kysely'
import { CloseFn, runTestServer } from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

describe('repo sync data migration', () => {
  let db: Database
  let rawDb: Kysely<any>
  let close: CloseFn

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'migration_repo_sync_data_pt_two',
    })
    db = server.ctx.db
    rawDb = db.db
    close = server.close
    const agent = new AtpAgent({ service: server.url })
    const sc = new SeedClient(agent)
    await basicSeed(sc)
  })

  afterAll(async () => {
    await close()
  })

  it('migrates down to pt2', async () => {
    await db.migrateToOrThrow('_20230201T200606704Z')
  })

  const getSnapshot = async () => {
    const [history, blocks] = await Promise.all([
      rawDb
        .selectFrom('repo_commit_history')
        .selectAll()
        .orderBy('creator')
        .orderBy('commit')
        .execute(),
      rawDb
        .selectFrom('repo_commit_block')
        .selectAll()
        .orderBy('creator')
        .orderBy('commit')
        .orderBy('block')
        .execute(),
    ])
    return { history, blocks }
  }

  let snapshot: { history: any[]; blocks: any[] }

  it('snapshots current state of commits', async () => {
    snapshot = await getSnapshot()
  })

  it('migrates down to pt1', async () => {
    await db.migrateToOrThrow('_20230127T224743452Z')
  })

  it('deletes some random commits', async () => {
    const toDelete: string[] = []
    for (const commit of snapshot.history) {
      if (Math.random() < 0.2) {
        toDelete.push(commit.commit)
      }
    }
    await rawDb
      .deleteFrom('repo_commit_block')
      .where('commit', 'in', toDelete)
      .execute()
    await rawDb
      .deleteFrom('repo_commit_history')
      .where('commit', 'in', toDelete)
      .execute()
  })

  it('migrates up', async () => {
    await db.migrateToOrThrow('_20230201T200606704Z')
  })

  it('backfilled missing commits', async () => {
    const newSnapshot = await getSnapshot()
    expect(newSnapshot).toEqual(snapshot)
  })
})
