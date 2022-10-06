import dotenv from 'dotenv'
import { IpldStore, MemoryBlockstore, PersistentBlockstore } from '@adxp/repo'
import * as crypto from '@adxp/crypto'
import Database from './db'
import server from './index'
import { ServerConfig } from './config'

const run = async () => {
  const env = process.env.ENV
  if (env) {
    dotenv.config({ path: `./.${env}.env` })
  } else {
    dotenv.config()
  }

  let blockstore: IpldStore
  let db: Database

  const cfg = ServerConfig.readEnv()

  if (cfg.blockstoreLocation) {
    blockstore = new PersistentBlockstore(cfg.blockstoreLocation)
  } else {
    blockstore = new MemoryBlockstore()
  }

  if (cfg.databaseLocation) {
    db = await Database.sqlite(cfg.databaseLocation)
  } else {
    db = await Database.memory()
  }

  const keypair = await crypto.EcdsaKeypair.create()

  const { listener } = server(blockstore, db, keypair, cfg)
  listener.on('listening', () => {
    console.log(`🌞 ADX Data server is running at ${cfg.origin}`)
  })
}

run()
