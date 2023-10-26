import { DatabaseSchema } from './schema'
import { Database, Migrator } from '../../db'
import migrations from './migrations'
export * from './schema'

export type ActorDb = Database<DatabaseSchema>

export const getDb = (location: string): ActorDb => {
  return Database.sqlite(location)
}

export const getMigrator = (db: Database<DatabaseSchema>) => {
  return new Migrator(db.db, migrations)
}
