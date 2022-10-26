import dotenv from 'dotenv'
import {
  IpldStore,
  MemoryBlockstore,
  PersistentBlockstore,
} from '@atproto/repo'
import * as crypto from '@atproto/crypto'
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

  const keypair = await crypto.EcdsaKeypair.create()
  const cfg = ServerConfig.readEnv({ recoveryKey: keypair.did() })

  if (cfg.blockstoreLocation) {
    blockstore = new PersistentBlockstore(cfg.blockstoreLocation)
  } else {
    blockstore = new MemoryBlockstore()
  }

  if (cfg.dbPostgresUrl) {
    db = Database.postgres({
      url: cfg.dbPostgresUrl,
      schema: cfg.dbPostgresSchema,
    })
  } else if (cfg.databaseLocation) {
    db = Database.sqlite(cfg.databaseLocation)
  } else {
    db = Database.memory()
  }

  await db.migrateToLatestOrThrow()

  const { listener } = server(blockstore, db, keypair, cfg)
  listener.on('listening', () => {
    console.log(`🌞 ATP Data server is running at ${cfg.origin}`)
  })
}

run()
