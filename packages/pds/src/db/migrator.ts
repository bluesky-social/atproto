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
 * Allows older PDS versions to start against databases migrated by newer
 * versions. Unknown migrations are accepted only if they sort after all known
 * migrations. Those are supplied to kysely as no-op stubs, which kysely sees
 * as already executed and never runs. A missing migration that sorts before
 * the latest known one still fails, as does any migration down (see
 * {@link Migrator.migrateToLatest}).
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
    // @NOTE Kysely holds sqlite's only connection while calling the provider.
    // Compute stubs beforehand, since querying from the provider would deadlock.
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
      const seen = await this.tolerateLaterMigrations()
      const result = await super.migrateToLatest(options)
      if (!result.error) return result
      // The stubs come from a read taken before kysely's lock. If a newer
      // version migrated in between, kysely's locked read finds a migration
      // with no stub. Retry once with a fresh read in that case only, so
      // genuine corruption still fails.
      const fresh = await this.tolerateLaterMigrations()
      if (fresh.every((name) => seen.includes(name))) return result
      return await super.migrateToLatest(options)
    } catch (error) {
      // Like kysely, report failures in the result rather than throwing
      return { error }
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

  // Sets up stubs for tolerated migrations, returning the executed names read.
  private async tolerateLaterMigrations(): Promise<string[]> {
    const executed = await this.readExecutedNames()
    const latestKnown = Object.keys(this.known).sort(compareNames).at(-1)
    const tolerated = executed.filter(
      (name) =>
        !Object.hasOwn(this.known, name) &&
        (latestKnown === undefined || compareNames(name, latestKnown) > 0),
    )
    const stubs = Object.fromEntries(
      tolerated.map((name): [string, Migration] => [name, { up: noop }]),
    )
    this.provided.migrations = { ...this.known, ...stubs }
    if (tolerated.length > 0) {
      dbLogger.warn(
        { tolerated },
        'database has migrations from a newer version',
      )
    }
    return executed
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
// @NOTE match Kysely's Object.keys(migrations).sort(). Avoid localeCompare(),
// whose ordering can change with the environment or Node.js version.
const compareNames = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

const noop = async () => {}
