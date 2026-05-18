import { Database, Migrator } from '../../db'
import { getAllMigrations } from './migrations'
import { DatabaseSchema } from './schema'
export * from './schema'

export type ActorDb = Database<DatabaseSchema>

export const getDb = (
  location: string,
  disableWalAutoCheckpoint = false,
): ActorDb => {
  const pragmas: Record<string, string> = disableWalAutoCheckpoint
    ? { wal_autocheckpoint: '0' }
    : {}
  return Database.sqlite(location, { pragmas })
}

export const getMigrator = (db: Database<DatabaseSchema>) => {
  // getAllMigrations() is called per-invocation so test-injected extras
  // registered with setExtraMigration() are picked up at call time.
  return new Migrator(db.db, getAllMigrations())
}

export const getMigrationLevel = async (
  db: ActorDb,
): Promise<string | null> => {
  const result = await db.db
    .selectFrom('kysely_migration' as any)
    .select('name')
    .orderBy('name', 'desc')
    .limit(1)
    .executeTakeFirst()
  return (result as { name: string } | undefined)?.name ?? null
}
