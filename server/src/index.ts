import dotenv from 'dotenv'
import { IpldStore } from '@bluesky/common'
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

if (process.env.IN_MEMORY) {
  blockstore = IpldStore.createInMemory()
  db = Database.memory()
} else {
  const bsLocation = process.env.BLOCKSTORE_LOC
  const dbLocation = process.env.DATABASE_LOC || './dev.sqlite'
  blockstore = IpldStore.createPersistent(bsLocation)
  db = Database.sqlite(dbLocation)
}

db.createTables()

const envPort = parseInt(process.env.PORT || '')
const port = isNaN(envPort) ? 2583 : envPort

server(blockstore, db, port)
