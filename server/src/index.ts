import { IpldStore } from '@bluesky-demo/common'
// import createDB from './db/persistent.js'
import createDB from './db/memory.js'
import * as tables from './db/tables.js'

import server from './server.js'

// const blockstore = IpldStore.createPersistent()
// const db = createDB('./db.sqlite')

const blockstore = IpldStore.createInMemory()
const db = createDB()
tables.create(db)

const PORT = 2583

server(blockstore, db, PORT)
