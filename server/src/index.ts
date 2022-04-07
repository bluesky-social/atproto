import { IpldStore } from '@bluesky-demo/common'
import Database from './db/index.js'
import server from './server.js'

let blockstore: IpldStore
let db: Database

if (process.env.IN_MEMORY) {
  blockstore = IpldStore.createInMemory()
  db = Database.memory()
} else {
  blockstore = IpldStore.createPersistent()
  db = Database.sqlite('./dev.sqlite')
}

db.createTables()

const envPort = parseInt(process.env.PORT || '')
const port = isNaN(envPort) ? 2583 : envPort

server(blockstore, db, port)
