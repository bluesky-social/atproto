import dotenv from 'dotenv'
import { Database } from './db'
import { server } from './server'

const run = async () => {
  const env = process.env.ENV
  if (env) {
    dotenv.config({ path: `./.${env}.env` })
  } else {
    dotenv.config()
  }

  let db: Database
  const dbLoc = process.env.DATABASE_LOC
  if (dbLoc) {
    db = await Database.sqlite(dbLoc)
  } else {
    db = await Database.memory()
  }

  const envPort = parseInt(process.env.PORT || '')
  const port = isNaN(envPort) ? 2582 : envPort

  const s = server(db, port)
  s.on('listening', () => {
    console.log(`🌞 PLC server is running at http://localhost:${port}`)
  })
}

run()
