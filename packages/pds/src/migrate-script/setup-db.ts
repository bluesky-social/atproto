import { Migrator } from 'kysely'
import { dbMigrationProvider, getDb } from './db'

const run = async () => {
  const db = getDb()

  const migrator = new Migrator({ db, provider: dbMigrationProvider })
  const { error } = await migrator.migrateToLatest()
  if (error) throw error
  return db
}

run()
