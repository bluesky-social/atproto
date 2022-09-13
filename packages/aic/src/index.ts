import { Database } from './db'
import { server } from './server'
import { dbLoc, defaultConsortiumJwk, port } from './config'
import * as crypto from '@adxp/crypto'

const run = async () => {
  const db =
    dbLoc && dbLoc.length > 0
      ? await Database.sqlite(dbLoc)
      : await Database.memory()

  const key = await crypto.EcdsaKeypair.import(defaultConsortiumJwk, {
    exportable: true,
  })
  const s = server(db, key, port)
  s.on('listening', () => {
    console.log(`🌞 ADX AIC server is running at http://localhost:${port}`)
  })
}

run()
