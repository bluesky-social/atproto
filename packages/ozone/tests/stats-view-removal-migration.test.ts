import assert from 'node:assert'
import { sql } from 'kysely'
import { Database } from '../src/db/index.js'

const views = [
  'account_events_stats',
  'record_events_stats',
  'account_record_events_stats',
  'account_record_status_stats',
]

describe('stats view removal migration', () => {
  const url = process.env.DB_POSTGRES_URL
  assert(url, 'DB_POSTGRES_URL is required')
  const schemas = ['ozone_stats_upgrade_test', 'ozone_stats_fresh_test']
  const databases = schemas.map((schema) => new Database({ schema, url }))

  afterAll(async () => {
    for (const db of databases) {
      await sql`DROP SCHEMA IF EXISTS ${sql.id(db.schema!)} CASCADE`.execute(
        db.db,
      )
      await db.close()
    }
  })

  const getViews = async (db: Database) => {
    const result = await sql<{ matviewname: string }>`
      SELECT matviewname FROM pg_matviews
      WHERE schemaname = ${db.schema} AND matviewname = ANY(${views})
    `.execute(db.db)
    return result.rows.map((row) => row.matviewname).sort()
  }

  it('drops existing views in dependency order without deleting other data', async () => {
    const db = databases[0]
    await db.migrateToOrThrow('_20261026T154047943Z')
    expect(await getViews(db)).toEqual([...views].sort())
    await sql`CREATE TABLE migration_sentinel (id integer PRIMARY KEY)`.execute(
      db.db,
    )
    await sql`INSERT INTO migration_sentinel (id) VALUES (7)`.execute(db.db)

    await db.migrateToLatestOrThrow()
    expect(await getViews(db)).toEqual([])
    const result = await sql<{
      id: number
    }>`SELECT id FROM migration_sentinel`.execute(db.db)
    expect(result.rows).toEqual([{ id: 7 }])
    await expect(db.migrateToOrThrow('_20261026T154047943Z')).rejects.toThrow(
      'manual rebuild',
    )
  })

  it('leaves no stats views on a fresh database', async () => {
    const db = databases[1]
    await db.migrateToLatestOrThrow()
    expect(await getViews(db)).toEqual([])
  })
})
