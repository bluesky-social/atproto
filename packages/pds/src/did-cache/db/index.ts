import { Database, Migrator } from '../../db'
import { DidCacheSchema } from './schema'
import migrations from './migrations'

export * from './schema'

export type DidCacheDb = Database<DidCacheSchema>

export const getDb = (location: string): DidCacheDb => {
  return Database.sqlite(location, { pragmas: { synchronous: 'NORMAL' } })
}

export const getMigrator = (db: DidCacheDb) => {
  return new Migrator(db.db, migrations)
}
