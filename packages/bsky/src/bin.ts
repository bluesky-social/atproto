import './env'
import { ServerConfig } from './config'
import * as crypto from '@atproto/crypto'
import Database from './db'
import PDS from './index'
import { DiskBlobStore, MemoryBlobStore } from './storage'
import { BlobStore } from '@atproto/repo'

const run = async () => {
  let db: Database

  const keypair = await crypto.EcdsaKeypair.create()
  const cfg = ServerConfig.readEnv({
    serverDid: keypair.did(),
    recoveryKey: keypair.did(),
  })

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

  let blobstore: BlobStore
  if (cfg.blobstoreLocation) {
    blobstore = await DiskBlobStore.create(
      cfg.blobstoreLocation,
      cfg.blobstoreTmp,
    )
  } else {
    blobstore = new MemoryBlobStore()
  }

  const pds = PDS.create({
    db,
    blobstore,
    repoSigningKey: keypair,
    plcRotationKey: keypair,
    config: cfg,
  })
  await pds.start()
  console.log(`🌞 ATP Data server is running at ${cfg.origin}`)
}

run()
