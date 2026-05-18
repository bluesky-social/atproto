import { Migration, sql } from 'kysely'
import * as init from './001-init'

const migrations: Record<string, Migration> = {
  '001': init,
}

export default migrations

// Test-only registry of extra migrations defined as raw SQL strings, keyed by
// migration name. We use raw SQL (not the kysely DSL) because the actor store
// migrator runs in a worker thread and JS functions cannot be transferred
// across the worker boundary.
const extraMigrations: Record<string, { upSql: string; downSql?: string }> = {}

export function setExtraMigration(
  name: string,
  upSql: string,
  downSql?: string,
) {
  extraMigrations[name] = { upSql, downSql }
}

export function clearExtraMigration(name: string) {
  delete extraMigrations[name]
}

export function getExtraMigrations(): Record<
  string,
  { upSql: string; downSql?: string }
> {
  return { ...extraMigrations }
}

// Resolves extra-migration SQL strings into kysely Migration objects and
// merges them with the static base set. Used by the migrator (on the main
// thread) and rebuilt with the same merging logic inside the worker.
export function getAllMigrations(): Record<string, Migration> {
  const result: Record<string, Migration> = { ...migrations }
  for (const [name, { upSql, downSql }] of Object.entries(extraMigrations)) {
    result[name] = {
      async up(db) {
        await sql.raw(upSql).execute(db)
      },
      async down(db) {
        if (downSql) await sql.raw(downSql).execute(db)
      },
    }
  }
  return result
}

// getter form so tests that register extra migrations get the right answer
export function getLatestStoreSchemaVersion(): string {
  return Object.keys(getAllMigrations()).sort().pop()!
}
