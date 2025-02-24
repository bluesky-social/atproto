import { Kysely, Migration, Migrator as KyselyMigrator } from 'kysely'

export class Migrator<T> extends KyselyMigrator {
  constructor(
    public db: Kysely<T>,
    migrations: Record<string, Migration>,
  ) {
    super({
      db,
      provider: {
        async getMigrations() {
          return migrations
        },
      },
    })
  }

  async migrateToOrThrow(migration: string) {
    const { error, results } = await this.migrateTo(migration)
    if (error) {
      throw error
    }
    if (!results) {
      throw new Error('An unknown failure occurred while migrating')
    }
    return results
  }

  async migrateToLatestOrThrow() {
    const { error, results } = await this.migrateToLatest()
    if (error) {
      throw error
    }
    if (!results) {
      throw new Error('An unknown failure occurred while migrating')
    }
    return results
  }
}
