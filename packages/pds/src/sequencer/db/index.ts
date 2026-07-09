import { Database, Migrator } from '../../db/index.js'
import migrations from './migrations/index.js'
import type { SequencerDbSchema } from './schema.js'

export * from './schema.js'

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
