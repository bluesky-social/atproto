import path from 'node:path'
import { Kysely } from 'kysely'
import { Database, Migrator } from '../../db'

export interface NewAccount {
  did: string
  published: 0 | 1
}

export interface Failed {
  did: string
  error: string | null
  fixed: 0 | 1
}

export type RecoveryDbSchema = {
  new_account: NewAccount
  failed: Failed
}

export type RecoveryDb = Database<RecoveryDbSchema>

export const getRecoveryDbFromSequencerLoc = (
  sequencerLoc: string,
): Promise<RecoveryDb> => {
  const recoveryDbLoc = path.join(path.dirname(sequencerLoc), 'recovery.sqlite')
  return getAndMigrateRecoveryDb(recoveryDbLoc)
}

export const getAndMigrateRecoveryDb = async (
  location: string,
  disableWalAutoCheckpoint = false,
): Promise<RecoveryDb> => {
  const pragmas: Record<string, string> = disableWalAutoCheckpoint
    ? { wal_autocheckpoint: '0' }
    : {}
  const db = Database.sqlite(location, pragmas)
  const migrator = new Migrator(db.db, migrations)
  await migrator.migrateToLatestOrThrow()
  return db
}

const migrations = {
  '001': {
    up: async (db: Kysely<unknown>) => {
      await db.schema
        .createTable('new_account')
        .addColumn('did', 'varchar', (col) => col.primaryKey())
        .addColumn('published', 'int2', (col) => col.notNull())
        .execute()

      await db.schema
        .createTable('failed')
        .addColumn('did', 'varchar', (col) => col.primaryKey())
        .addColumn('error', 'varchar')
        .addColumn('fixed', 'int2', (col) => col.notNull())
        .execute()
    },
    down: async (db: Kysely<unknown>) => {
      await db.schema.dropTable('new_account').execute()
      await db.schema.dropTable('failed').execute()
    },
  },
}
