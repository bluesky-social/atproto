import { Database, Migrator } from '../../db'
import { SequencerDbSchema } from './schema'
import migrations from './migrations'

export * from './schema'

export type SequencerDb = Database<SequencerDbSchema>

export const getDb = (location: string): SequencerDb => {
  return Database.sqlite(location)
}

export const getMigrator = (db: Database<SequencerDbSchema>) => {
  return new Migrator(db.db, migrations)
}
