import { DatabaseSchema } from './schema'
import { Database, Migrator } from '../../db'
import * as migrations from './migrations'
export * from './schema'

export type ActorDb = Database<DatabaseSchema>

export const getMigrator = (db: Database<DatabaseSchema>) => {
  return new Migrator(db.db, migrations)
}
