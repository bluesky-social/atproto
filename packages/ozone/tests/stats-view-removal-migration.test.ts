import assert from 'node:assert'
import { randomBytes } from 'node:crypto'
import { type Kysely, sql } from 'kysely'
import { Database } from '../src/db/index.js'
import {
  down,
  up,
} from '../src/db/migrations/20261103T190000000Z-drop-moderation-stats-views.js'
import * as migrations from '../src/db/migrations/index.js'
import type { CtxMigration } from '../src/db/migrations/provider.js'

const views = [
  'account_events_stats',
  'record_events_stats',
  'account_record_events_stats',
  'account_record_status_stats',
]

describe('stats view removal migration', () => {
  const url = process.env.DB_POSTGRES_URL
  assert(url, 'DB_POSTGRES_URL is required')
  const db = new Database({ url })

  afterAll(async () => db.close())

  const withFixture = async (
    run: (
      trx: Kysely<unknown>,
      schema: string,
      fallback: string,
    ) => Promise<void>,
  ) => {
    const suffix = Array.from(randomBytes(8), (byte) =>
      String.fromCharCode(97 + (byte % 26)),
    ).join('')
    const schema = `ozone_stats_fixture_${suffix}`
    const fallback = `${schema}_fallback`
    const rollback = new Error('rollback fixture')
    try {
      await db.db.transaction().execute(async (trx) => {
        // @NOTE Uncommitted schemas are invisible to other suites' catalog
        // introspection and rollback removes the fixture without a DROP race.
        await trx.schema.createSchema(schema).execute()
        await trx.schema.createSchema(fallback).execute()
        await sql`SET LOCAL search_path TO ${sql.id(schema)}, ${sql.id(fallback)}, public`.execute(
          trx,
        )
        await run(trx as unknown as Kysely<unknown>, schema, fallback)
        throw rollback
      })
    } catch (err) {
      if (err !== rollback) throw err
    }
  }

  const getViews = async (trx: Kysely<unknown>, schema: string) => {
    const result = await sql<{ matviewname: string }>`
      SELECT matviewname FROM pg_matviews
      WHERE schemaname = ${schema} AND matviewname = ANY(${views})
    `.execute(trx)
    return result.rows.map((row) => row.matviewname).sort()
  }

  it('drops existing views in dependency order without deleting other data', async () => {
    await withFixture(async (trx, schema) => {
      expect(migrations._20261103T190000000Z.up).toBe(up)
      const previousMigrations = Object.entries(migrations)
        .filter(([name]) => name < '_20261103T190000000Z')
        .sort(([a], [b]) => a.localeCompare(b))
      for (const [, migration] of previousMigrations) {
        await (migration as CtxMigration<string>).up(trx, 'pg')
      }
      await sql`CREATE TABLE migration_sentinel (id integer PRIMARY KEY)`.execute(
        trx,
      )
      await sql`INSERT INTO migration_sentinel (id) VALUES (7)`.execute(trx)
      expect(await getViews(trx, schema)).toEqual([...views].sort())

      await up(trx)
      expect(await getViews(trx, schema)).toEqual([])
      const result = await sql<{
        id: number
      }>`SELECT id FROM migration_sentinel`.execute(trx)
      expect(result.rows).toEqual([{ id: 7 }])
    })
    await expect(down()).rejects.toThrow('manual rebuild')
  })

  it('succeeds when the views are already absent', async () => {
    await withFixture(async (trx, schema, fallback) => {
      for (const view of views) {
        await sql`CREATE MATERIALIZED VIEW ${sql.id(fallback, view)} AS SELECT 7 AS id`.execute(
          trx,
        )
      }
      await up(trx)
      expect(await getViews(trx, schema)).toEqual([])
      expect(await getViews(trx, fallback)).toEqual([...views].sort())
    })
  })
})
