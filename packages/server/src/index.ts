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

  if (dbLoc) {
    db = await Database.sqlite(dbLoc)
  } else {
    db = await Database.memory()
  }

  const keypair = await crypto.EcdsaKeypair.create()

  const envPort = parseInt(process.env.PORT || '')
  const port = isNaN(envPort) ? 2583 : envPort

  const s = server(blockstore, db, keypair, port)
  s.on('listening', () => {
    console.log(`🌞 ADX Data server is running at http://localhost:${port}`)
  })
}

run()
