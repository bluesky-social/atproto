import dotenv from 'dotenv'
import { IpldStore, MemoryBlockstore, PersistentBlockstore } from '@adxp/common'
import * as crypto from '@adxp/crypto'
import Database from './db'
import server from './server'

const run = async () => {
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
    blockstore = new PersistentBlockstore(bsLoc)
  } else {
    blockstore = new MemoryBlockstore()
  }

  db = await Database.sqlite(dbLoc || 'test.sqlite')

  // if (dbLoc) {
  //   db = Database.sqlite(dbLoc)
  // } else {
  //   // @TODO add in memory option
  //   throw new Error('TODO: no memory db')
  //   // db = Database.memory()
  // }

  // db.createTables()

  const keypair = await crypto.EcdsaKeypair.create()

  const envPort = parseInt(process.env.PORT || '')
  const port = isNaN(envPort) ? 2583 : envPort

  const s = server(blockstore, db, keypair, port)
  s.on('listening', () => {
    console.log(`🌞 ADX Data server is running at http://localhost:${port}`)
  })
}

run()
