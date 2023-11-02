import { Kysely, MigrationProvider, Migrator, SqliteDialect } from 'kysely'
import SqliteDB from 'better-sqlite3'

export const getDb = async (loc: string): Promise<MigrateDb> => {
  const db = new Kysely<Schema>({
    dialect: new SqliteDialect({
      database: new SqliteDB(loc),
    }),
  })
  const migrator = new Migrator({ db, provider: dbMigrationProvider })
  const { error } = await migrator.migrateToLatest()
  if (error) throw error
  return db
}

const dbMigrationProvider: MigrationProvider = {
  async getMigrations() {
    return {
      '1': {
        async up(db: Kysely<unknown>) {
          await db.schema
            .createTable('status')
            .addColumn('did', 'varchar', (col) => col.primaryKey())
            .addColumn('pdsId', 'integer')
            .addColumn('signingKey', 'varchar')
            .addColumn('phase', 'integer')
            .addColumn('importedRev', 'varchar')
            .addColumn('failed', 'integer')
            .execute()
          await db.schema
            .createTable('failed_pref')
            .addColumn('did', 'varchar', (col) => col.primaryKey())
            .execute()
          await db.schema
            .createTable('failed_blob')
            .addColumn('did', 'varchar', (col) => col.notNull())
            .addColumn('cid', 'varchar', (col) => col.notNull())
            .addPrimaryKeyConstraint('failed_blob_pkey', ['did', 'cid'])
            .execute()
          await db.schema
            .createTable('failed_takedown')
            .addColumn('did', 'varchar', (col) => col.notNull())
            .addColumn('recordUri', 'varchar')
            .addColumn('recordCid', 'varchar')
            .addColumn('blobCid', 'varchar')
            .execute()
        },
        async down() {},
      },
    }
  },
}

export type MigrateDb = Kysely<Schema>

type Schema = {
  status: Status
  failed_pref: FailedPreference
  failed_blob: FailedBlob
  failed_takedown: FailedTakedown
}

export enum TransferPhase {
  notStarted = 0,
  reservedKey = 1,
  initImport = 2,
  transferred = 4,
  preferences = 5,
  takedowns = 6,
  completed = 7,
}

export type Status = {
  did: string
  pdsId: number | null
  signingKey: string | null
  phase: TransferPhase
  importedRev: string | null
  failed: 0 | 1
}

export type FailedPreference = {
  did: string
}

export type FailedBlob = {
  did: string
  cid: string
}

export type FailedTakedown = {
  did: string
  blobCid?: string
  recordUri?: string
  recordCid?: string
}
