import { Database, Migrator } from '../../db'
import migrations from './migrations'
import { DatabaseSchema } from './schema'

export * from './schema'

export type AccountDb = Database<DatabaseSchema>

export const getDb = (
  location: string,
  disableWalAutoCheckpoint = false,
): AccountDb => {
  const pragmas: Record<string, string> = disableWalAutoCheckpoint
    ? { wal_autocheckpoint: '0' }
    : {}
  return Database.sqlite(location, { pragmas })
}

export const getMigrator = (db: AccountDb) => {
  return new Migrator(db.db, migrations)
}
