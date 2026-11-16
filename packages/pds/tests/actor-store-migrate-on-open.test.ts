import { jest } from '@jest/globals'
import SqliteDB from 'better-sqlite3'
import { TestPds, TestPlc } from '@atproto/dev-env'
import { Migrator } from '../src/db/migrator.js'

const SPACE_TABLES = [
  'space',
  'memberspace_member',
  'space_policy',
  'space_record',
  'space_record_blob',
  'space_repo',
  'space_record_oplog',
  'space_writer',
  'space_notify_registration',
]

describe('actor store migration on open', () => {
  let plc: TestPlc
  let pds: TestPds

  beforeAll(async () => {
    plc = await TestPlc.create({})
    pds = await TestPds.create({ didPlcUrl: plc.url })
  })

  afterAll(async () => {
    await pds?.close()
    await plc?.close()
  })

  let counter = 0
  const createAccount = async () => {
    const agent = pds.getAgent()
    const n = counter++
    await agent.createAccount({
      handle: `user${n}.test`,
      email: `user${n}@test.com`,
      password: 'pass',
    })
    return agent.assertDid
  }

  const withFile = async <T>(did: string, fn: (db: SqliteDB.Database) => T) => {
    const { dbLocation } = await pds.ctx.actorStore.getLocation(did)
    const db = new SqliteDB(dbLocation)
    try {
      return fn(db)
    } finally {
      db.close()
    }
  }

  // A store as created by the release before spaces: migration '001' only
  const createPreSpacesStore = async () => {
    const did = await createAccount()
    await withFile(did, (db) => {
      for (const table of SPACE_TABLES) db.exec(`drop table "${table}"`)
      db.prepare('delete from kysely_migration where name = ?').run('002')
    })
    return did
  }

  const tables = (did: string) =>
    withFile(did, (db) =>
      db
        .prepare("select name from sqlite_master where type = 'table'")
        .all()
        .map((row) => (row as { name: string }).name),
    )

  const migrations = (did: string) =>
    withFile(did, (db) =>
      db
        .prepare('select name from kysely_migration order by name')
        .all()
        .map((row) => (row as { name: string }).name),
    )

  it('migrates a pre-spaces store when it is opened', async () => {
    const did = await createPreSpacesStore()
    expect(await tables(did)).not.toContain('space')

    await pds.ctx.actorStore.read(did, async (store) => {
      await store.repo.storage.getRoot()
    })

    expect(await tables(did)).toEqual(expect.arrayContaining(SPACE_TABLES))
    expect(await migrations(did)).toEqual(['001', '002'])
  })

  it('migrates once when two requests open a pre-spaces store together', async () => {
    const did = await createPreSpacesStore()
    const read = () => pds.ctx.actorStore.read(did, async () => {})
    await Promise.all([read(), read()])
    expect(await migrations(did)).toEqual(['001', '002'])
    expect(await tables(did)).toContain('space')
  })

  it('does not run the migrator when the store is current', async () => {
    const did = await createAccount()
    using spy = jest.spyOn(Migrator.prototype, 'migrateToLatestOrThrow')
    await pds.ctx.actorStore.read(did, async () => {})
    expect(spy).toHaveBeenCalledTimes(0)
  })

  it('opens a store a newer version migrated', async () => {
    const did = await createAccount()
    await withFile(did, (db) =>
      db
        .prepare('insert into kysely_migration (name, timestamp) values (?, ?)')
        .run('999-future', new Date().toISOString()),
    )
    await pds.ctx.actorStore.read(did, async () => {})
    expect(await migrations(did)).toEqual(['001', '002', '999-future'])
  })
})
