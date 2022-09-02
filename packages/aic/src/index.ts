import { database } from './db'
import { server } from './server'
import { dbLoc, defaultConsortiumJwk, port } from './config'
import { createAsymmetric } from './crypto'

const run = async () => {
  const db = await database(dbLoc)
  const consortiumCrypto = await createAsymmetric(defaultConsortiumJwk)
  const s = server(db, consortiumCrypto, port)
  s.on('listening', () => {
    console.log(`🌞 ADX AIC server is running at http://localhost:${port}`)
  })
}

run()
