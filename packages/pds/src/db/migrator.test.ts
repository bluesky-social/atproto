import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
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

describe('Migrator on a shared database file', () => {
  let dir: string
  let file: string

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'pds-migrator-'))
    file = path.join(dir, 'test.sqlite')
    const db = Database.sqlite(file)
    await db.ensureWal()
    await db.close()
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('serializes concurrent migrations from two connections', async () => {
    const migrations: Record<string, Migration> = {
      '001': {
        async up(db: Kysely<unknown>) {
          await db.schema.createTable('t_a').addColumn('x', 'integer').execute()
          // Hold the migration open so the other connection overlaps it
          await sleep(200)
          await db.schema.createTable('t_b').addColumn('x', 'integer').execute()
        },
      },
      '002': createsTable('t_c'),
    }
    const db1 = Database.sqlite(file)
    const db2 = Database.sqlite(file)
    try {
      const [results1, results2] = await Promise.all([
        new Migrator(db1.db, migrations).migrateToLatestOrThrow(),
        new Migrator(db2.db, migrations).migrateToLatestOrThrow(),
      ])

      // Exactly one connection did the work; the other found nothing pending
      expect([resultNames(results1), resultNames(results2)].sort()).toEqual([
        [],
        ['001', '002'],
      ])
      expect(await tableNames(db1)).toEqual(['t_a', 't_b', 't_c'])
      expect(await executedNames(db1)).toEqual(['001', '002'])
    } finally {
      await db1.close()
      await db2.close()
    }
  })

  it('rolls back every pending migration when one fails', async () => {
    const db = Database.sqlite(file)
    try {
      await expect(
        new Migrator(db.db, {
          '001': createsTable('t_a'),
          '002': {
            async up(db: Kysely<unknown>) {
              await createsTable('t_c').up(db)
              throw new Error('boom')
            },
          },
        }).migrateToLatestOrThrow(),
      ).rejects.toThrow(/boom/)
      expect(await tableNames(db)).toEqual([])
      expect(await executedNames(db)).toEqual([])

      const results = await new Migrator(db.db, {
        '001': createsTable('t_a'),
        '002': createsTable('t_c'),
      }).migrateToLatestOrThrow()
      expect(resultNames(results)).toEqual(['001', '002'])
    } finally {
      await db.close()
    }
  })
})
