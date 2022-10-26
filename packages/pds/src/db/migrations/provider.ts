import { Kysely, Migration, MigrationProvider } from 'kysely'

// Passes a context argument to migrations. We use this to thread the dialect into migrations

export class CtxMigrationProvider<T> implements MigrationProvider {
  constructor(
    private migrations: Record<string, CtxMigration<T>>,
    private ctx: T,
  ) {}
  async getMigrations(): Promise<Record<string, Migration>> {
    const ctxMigrations: Record<string, Migration> = {}
    Object.entries(this.migrations).forEach(([name, migration]) => {
      ctxMigrations[name] = {
        up: (db) => migration.up(db, this.ctx),
        down: (db) => Promise.resolve(migration.down?.(db, this.ctx)),
      }
    })
    return ctxMigrations
  }
}

export interface CtxMigration<T> {
  up(db: Kysely<unknown>, ctx: T): Promise<void>
  down?(db: Kysely<unknown>, ctx: T): Promise<void>
}
