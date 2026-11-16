import type { Kysely } from 'kysely'
import { sql } from 'kysely'
import type { Migration } from 'kysely/migration'
import { Database } from './db.js'
import { Migrator } from './migrator.js'

const createsTable = (name: string): Migration => ({
  async up(db: Kysely<unknown>) {
    await db.schema.createTable(name).addColumn('x', 'integer').execute()
  },
})

// Each migration creates a table named after itself, so its effects are visible.
const migrationsFor = (...names: string[]): Record<string, Migration> =>
  Object.fromEntries(names.map((name) => [name, createsTable(`t_${name}`)]))

const executedNames = async (db: Database<unknown>): Promise<string[]> => {
  const { rows } = await sql<{
    name: string
  }>`select name from kysely_migration order by name`.execute(db.db)
  return rows.map((row) => row.name)
}

const tableNames = async (db: Database<unknown>): Promise<string[]> => {
  const { rows } = await sql<{
    name: string
  }>`select name from sqlite_master where type = 'table' and name like 't\\_%' escape '\\' order by name`.execute(
    db.db,
  )
  return rows.map((row) => row.name)
}

const resultNames = (results: { migrationName: string }[]) =>
  results.map((result) => result.migrationName)

describe('Migrator', () => {
  let db: Database<unknown>

  beforeEach(() => {
    db = Database.sqlite(':memory:')
  })

  afterEach(async () => {
    await db.close()
  })

  it('runs all known migrations on a fresh database', async () => {
    const results = await new Migrator(
      db.db,
      migrationsFor('001', '002'),
    ).migrateToLatestOrThrow()

    expect(resultNames(results)).toEqual(['001', '002'])
    expect(await tableNames(db)).toEqual(['t_001', 't_002'])
    expect(await executedNames(db)).toEqual(['001', '002'])
  })

  it('tolerates later migrations it does not know', async () => {
    await new Migrator(
      db.db,
      migrationsFor('001', '002', '003'),
    ).migrateToLatestOrThrow()

    const results = await new Migrator(
      db.db,
      migrationsFor('001'),
    ).migrateToLatestOrThrow()

    expect(results).toEqual([])
    expect(await executedNames(db)).toEqual(['001', '002', '003'])
    expect(await tableNames(db)).toEqual(['t_001', 't_002', 't_003'])
  })

  it('runs its own pending migrations alongside tolerated later ones', async () => {
    // A newer version ran 001-003, an older version (knowing 001-002) then
    // booted, and a newer-again version adds 004.
    await new Migrator(
      db.db,
      migrationsFor('001', '002', '003'),
    ).migrateToLatestOrThrow()

    const older = await new Migrator(
      db.db,
      migrationsFor('001', '002'),
    ).migrateToLatestOrThrow()
    expect(older).toEqual([])

    const newer = await new Migrator(
      db.db,
      migrationsFor('001', '002', '003', '004'),
    ).migrateToLatestOrThrow()
    expect(resultNames(newer)).toEqual(['004'])
    expect(await executedNames(db)).toEqual(['001', '002', '003', '004'])
  })

  it('still rejects an unknown migration that sorts before its latest', async () => {
    await new Migrator(
      db.db,
      migrationsFor('001', '002'),
    ).migrateToLatestOrThrow()

    await expect(
      new Migrator(db.db, migrationsFor('001', '003')).migrateToLatestOrThrow(),
    ).rejects.toThrow(/corrupted migrations/)
  })

  it('still rejects a known migration missing before tolerated ones', async () => {
    await new Migrator(
      db.db,
      migrationsFor('001', '003'),
    ).migrateToLatestOrThrow()

    await expect(
      new Migrator(db.db, migrationsFor('001', '002')).migrateToLatestOrThrow(),
    ).rejects.toThrow(/corrupted migrations/)
  })

  it('never migrates down past later migrations it does not know', async () => {
    // Migrating "to" an earlier name is a rollback in kysely. With unknown
    // later migrations present it must fail, not delete their rows.
    await new Migrator(
      db.db,
      migrationsFor('001', '002', '003'),
    ).migrateToLatestOrThrow()

    await expect(
      new Migrator(db.db, migrationsFor('001', '002')).migrateToOrThrow('002'),
    ).rejects.toThrow(/corrupted migrations/)
    expect(await executedNames(db)).toEqual(['001', '002', '003'])
  })
})
