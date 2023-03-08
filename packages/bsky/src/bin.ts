import './env'
import { BlobStore } from '@atproto/repo'
import { ServerConfig } from './config'
import Database from './db'
import BskyAppView from './index'
import { DiskBlobStore, MemoryBlobStore } from './storage'
import { AddressInfo } from 'net'

const run = async () => {
  const cfg = ServerConfig.readEnv()
  const db = Database.postgres({
    url: cfg.dbPostgresUrl,
    schema: cfg.dbPostgresSchema,
  })

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

  const bsky = BskyAppView.create({
    db,
    blobstore,
    config: cfg,
  })

  await bsky.start()

  const { address } = bsky.server?.address() as AddressInfo
  console.log(`🌞 Bsky App View is running at ${address}`)
}

run()
