import './env'
import { ServerConfig } from './config'
import Database from './db'
import BskyAppView from './index'
import { AddressInfo } from 'net'

const run = async () => {
  const cfg = ServerConfig.readEnv()
  const db = Database.postgres({
    isPrimary: true,
    url: cfg.dbPrimaryPostgresUrl,
    schema: cfg.dbPostgresSchema,
  }).asPrimary()

  await db.migrateToLatestOrThrow()

  const bsky = BskyAppView.create({
    dbPrimary: db,
    config: cfg,
  })
  await bsky.start()

  const { address, port, family } = bsky.server?.address() as AddressInfo
  const location =
    family === 'IPv6' ? `[${address}]:${port}` : `${address}:${port}`
  console.log(`🌞 Bsky App View is running at ${location}`)
}

run()
