import { Database, Migrator } from '../../db'
import migrations from './migrations'
import { DatabaseSchema } from './schema'

export * from './schema'

export type SSODb = Database<DatabaseSchema>

export const getDb = (
  location: string,
  disableWalAutoCheckpoint = false,
): SSODb => {
  const pragmas: Record<string, string> = disableWalAutoCheckpoint
    ? { wal_autocheckpoint: '0' }
    : {}
  return Database.sqlite(location, { pragmas })
}

export const getMigrator = (db: SSODb) => {
  return new Migrator(db.db, migrations)
}
