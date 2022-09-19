import { Database } from './db'
import { server } from './server'
import { dbLoc, port } from './config'

const run = async () => {
  const db =
    dbLoc && dbLoc.length > 0
      ? await Database.sqlite(dbLoc)
      : await Database.memory()

  const s = server(db, port)
  s.on('listening', () => {
    console.log(`🌞 PLC server is running at http://localhost:${port}`)
  })
}

run()
