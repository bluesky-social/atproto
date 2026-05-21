import { Database, Migrator } from '../../db/index.js'
import migrations from './migrations.js'
import { DidCacheSchema } from './schema.js'

export * from './schema.js'

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
