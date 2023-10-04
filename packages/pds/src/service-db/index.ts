import { Database, Migrator } from '../db'
import { DatabaseSchema } from './schema'
import * as migrations from './migrations'

export * from './schema'

export type ServiceDb = Database<DatabaseSchema>

export const getMigrator = (db: Database<DatabaseSchema>) => {
  return new Migrator(db.db, migrations)
}
