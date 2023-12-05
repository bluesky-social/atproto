import { Database, Migrator } from '../../db'
import { DidCacheSchema } from './schema'
import migrations from './migrations'

export * from './schema'

export type DidCacheDb = Database<DidCacheSchema>

export const getDb = (
  location: string,
  disableWalAutoCheckpoint = false,
): DidCacheDb => {
  const pragmas: Record<string, string> = disableWalAutoCheckpoint
    ? { wal_autocheckpoint: '0', synchronous: 'NORMAL' }
    : { synchronous: 'NORMAL' }
  return Database.sqlite(location, { pragmas })
}

export const getMigrator = (db: DidCacheDb) => {
  return new Migrator(db.db, migrations)
}
