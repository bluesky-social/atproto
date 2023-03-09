import Database from '../db'

const run = async () => {
  const db = Database.postgres({
    url: 'postgresql://pg:password@localhost:5432/postgres',
  })
  await db.migrateToOrThrow('_20230304T193548198Z')
}

run()
