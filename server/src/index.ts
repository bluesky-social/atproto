import dotenv from 'dotenv'
import { IpldStore } from '@adxp/common'
import Database from './db/index.js'
import server from './server.js'

const env = process.env.ENV
if (env) {
  dotenv.config({ path: `./.${env}.env` })
} else {
  dotenv.config()
}

let blockstore: IpldStore
let db: Database

const bsLoc = process.env.BLOCKSTORE_LOC
const dbLoc = process.env.DATABASE_LOC

if (bsLoc) {
  blockstore = IpldStore.createPersistent(bsLoc)
} else {
  blockstore = IpldStore.createInMemory()
}

if (dbLoc) {
  db = Database.sqlite(dbLoc)
} else {
  db = Database.memory()
}

db.createTables()

const envPort = parseInt(process.env.PORT || '')
const port = isNaN(envPort) ? 2583 : envPort

const s = server(blockstore, db, port)
s.on('listening', () => {
  console.log(`🌞 ADX Data server is running at http://localhost:${port}`)
})
