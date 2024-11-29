import { Database, Migrator } from '../../db'
import { SequencerDbSchema } from './schema'
import migrations from './migrations'

export * from './schema'

export type SequencerDb = Database<SequencerDbSchema>

export const getDb = async (
  location: string,
  disableWalAutoCheckpoint = false,
): Promise<SequencerDb> => {
  const pragmas: Record<string, string> = disableWalAutoCheckpoint
    ? { wal_autocheckpoint: '0' }
    : {}
  return await Database.sqlite(location, pragmas)
}

export const getMigrator = (db: Database<SequencerDbSchema>) => {
  return new Migrator(db.db, migrations)
}
