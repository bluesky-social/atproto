import { type Kysely, sql } from 'kysely'
import {
  type MigrateOptions,
  type Migration,
  type MigrationResultSet,
  Migrator as KyselyMigrator,
} from 'kysely/migration'
import { dbLogger } from '../logger.js'
import { retrySqlite } from './util.js'

/**
 * Kysely's migrator, made forward compatible: a database that a newer version
 * of the PDS has already migrated still boots. Releases are rolled back by
 * re-tagging an older image, so older code must accept migrations it doesn't
 * know, provided they all come after its own. Those are supplied to kysely as
 * no-op stubs, which kysely sees as already executed and never runs. A missing
 * migration that sorts before the latest known one still fails, as does any
 * migration down (see {@link Migrator.migrateToLatest}).
 *
 * This relies on migrations being additive only (see packages/pds/AGENTS.md).
 */
export class Migrator<T> extends KyselyMigrator {
  private readonly known: Record<string, Migration>
  private readonly provided: { migrations: Record<string, Migration> }

  constructor(
    public db: Kysely<T>,
    migrations: Record<string, Migration>,
  ) {
    // Kysely calls the provider while it holds SQLite's only connection, so the
    // provider must not query the database. The stubs are computed beforehand.
    const provided = { migrations }
    super({
      db,
      provider: {
        async getMigrations() {
          return provided.migrations
        },
      },
    })
    this.known = migrations
    this.provided = provided
  }

  /**
   * Only migrating to the latest tolerates later migrations. `migrateTo` an
   * earlier name is a migration down in kysely, and with stubs present it
   * would delete the rows of migrations it doesn't know.
   */
  override async migrateToLatest(
    options?: MigrateOptions,
  ): Promise<MigrationResultSet> {
    try {
      await this.tolerateLaterMigrations()
    } catch (error) {
      // Like kysely, report failures in the result rather than throwing
      return { error }
    }
    try {
      return await super.migrateToLatest(options)
    } finally {
      this.provided.migrations = this.known
    }
  }

  // Retries SQLITE_BUSY: another connection may hold the migration lock.
  async migrateToOrThrow(migration: string) {
    return retrySqlite(async () => {
      const { error, results } = await this.migrateTo(migration)
      if (error) {
        throw error
      }
      if (!results) {
        throw new Error('An unknown failure occurred while migrating')
      }
      return results
    })
  }

  // Retries SQLITE_BUSY: another connection may hold the migration lock.
  async migrateToLatestOrThrow() {
    return retrySqlite(async () => {
      const { error, results } = await this.migrateToLatest()
      if (error) {
        throw error
      }
      if (!results) {
        throw new Error('An unknown failure occurred while migrating')
      }
      return results
    })
  }

  private async tolerateLaterMigrations(): Promise<void> {
    const latestKnown = Object.keys(this.known).sort(compareNames).at(-1)
    const tolerated = (await this.readExecutedNames()).filter(
      (name) =>
        !Object.hasOwn(this.known, name) &&
        (latestKnown === undefined || compareNames(name, latestKnown) > 0),
    )
    if (tolerated.length === 0) return
    dbLogger.warn({ tolerated }, 'database has migrations from a newer version')
    const stubs = Object.fromEntries(
      tolerated.map((name): [string, Migration] => [name, { up: noop }]),
    )
    this.provided.migrations = { ...this.known, ...stubs }
  }

  private async readExecutedNames(): Promise<string[]> {
    const { rows: tables } = await sql<{ name: string }>`
      select name from sqlite_master
      where type = 'table' and name = ${MIGRATION_TABLE}
    `.execute(this.db)
    if (tables.length === 0) return []
    const { rows } = await sql<{ name: string }>`
      select name from ${sql.table(MIGRATION_TABLE)}
    `.execute(this.db)
    return rows.map((row) => row.name)
  }
}

// Kysely's defaults, which every PDS database uses.
const MIGRATION_TABLE = 'kysely_migration'
const compareNames = (a: string, b: string) => a.localeCompare(b)

const noop = async () => {}
