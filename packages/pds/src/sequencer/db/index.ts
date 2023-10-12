import { Database, Migrator } from '../../db'
import { SequencerDbSchema } from './schema'
import * as migrations from './migrations'

export * from './schema'

export type SequencerDb = Database<SequencerDbSchema>

export const getMigrator = (db: Database<SequencerDbSchema>) => {
  return new Migrator(db.db, migrations)
}
