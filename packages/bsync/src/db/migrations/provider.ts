import type { Migration, MigrationProvider } from 'kysely/migration'

export class DbMigrationProvider implements MigrationProvider {
  constructor(private migrations: Record<string, Migration>) {}
  async getMigrations(): Promise<Record<string, Migration>> {
    return this.migrations
  }
}
