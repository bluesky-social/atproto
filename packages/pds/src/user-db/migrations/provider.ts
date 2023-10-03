import { Kysely, Migration, MigrationProvider } from 'kysely'

// @TODO remove/cleanup

// Passes a context argument to migrations. We use this to thread the dialect into migrations

export class CtxMigrationProvider implements MigrationProvider {
  constructor(private migrations: Record<string, CtxMigration>) {}
  async getMigrations(): Promise<Record<string, Migration>> {
    const ctxMigrations: Record<string, Migration> = {}
    Object.entries(this.migrations).forEach(([name, migration]) => {
      ctxMigrations[name] = {
        up: async (db) => await migration.up(db),
        down: async (db) => await migration.down?.(db),
      }
    })
    return ctxMigrations
  }
}

export interface CtxMigration {
  up(db: Kysely<unknown>): Promise<void>
  down?(db: Kysely<unknown>): Promise<void>
}
