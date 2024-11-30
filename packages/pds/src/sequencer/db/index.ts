import { Database, Migrator } from '../../db'
import { SequencerDbSchema } from './schema'
import migrations from './migrations'

export * from './schema'

export type SequencerDb = Database<SequencerDbSchema>

export const getDb = (
  location: string,
  disableWalAutoCheckpoint = false,
): SequencerDb => {
  const pragmas: Record<string, string> = disableWalAutoCheckpoint
    ? { wal_autocheckpoint: '0' }
    : {}
  return Database.sqlite(location, pragmas)
}

export const getMigrator = (db: Database<SequencerDbSchema>) => {
  return new Migrator(db.db, migrations)
}
