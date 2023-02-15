import './env'
import { Database } from './server/db'
import PlcServer from './server'

const run = async () => {
  const dbLoc = process.env.DATABASE_LOC
  const dbPostgresUrl = process.env.DB_POSTGRES_URL

  let db: Database
  if (dbPostgresUrl) {
    db = Database.postgres({ url: dbPostgresUrl })
  } else if (dbLoc) {
    db = Database.sqlite(dbLoc)
  } else {
    db = Database.memory()
  }

  await db.migrateToLatestOrThrow()

  const envPort = parseInt(process.env.PORT || '')
  const port = isNaN(envPort) ? 2582 : envPort

  const plc = PlcServer.create({ db, port })
  await plc.start()
  console.log(`👤 PLC server is running at http://localhost:${port}`)
}

run()
