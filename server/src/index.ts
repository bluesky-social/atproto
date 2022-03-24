import { IpldStore } from '@bluesky-demo/common'
import Database from './db/index.js'
import server from './server.js'

// const blockstore = IpldStore.createPersistent()
// const db = createDB('./dev.sqlite')

const blockstore = IpldStore.createInMemory()
const db = Database.memory()
db.createTables()

const PORT = 2583

server(blockstore, db, PORT)
