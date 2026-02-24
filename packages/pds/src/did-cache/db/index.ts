import { Database, Migrator } from '../../db'
import migrations from './migrations'
import { DidCacheSchema } from './schema'

export * from './schema'

export type DidCacheDb = Database<DidCacheSchema>

export const getDb = (
  location: string,
  disableWalAutoCheckpoint = false,
): DidCacheDb => {
  const pragmas: Record<string, string> = disableWalAutoCheckpoint
    ? { wal_autocheckpoint: '0' }
    : {}
  return Database.sqlite(location, { pragmas })
}

export const getMigrator = (db: DidCacheDb) => {
  return new Migrator(db.db, migrations)
}
