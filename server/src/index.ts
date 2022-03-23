import { IpldStore } from '@bluesky-demo/common'
import createDB from './db/persistent.js'

import server from './server.js'

const blockstore = IpldStore.createPersistent()
const db = createDB('./db.sqlite')

const PORT = 2583

server(blockstore, db, PORT)
