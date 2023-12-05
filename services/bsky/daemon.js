'use strict' /* eslint-disable */

require('dd-trace/init') // Only works with commonjs

// Tracer code above must come before anything else
const { PrimaryDatabase, DaemonConfig, BskyDaemon } = require('@atproto/bsky')

const main = async () => {
  const env = getEnv()
  const db = new PrimaryDatabase({
    url: env.dbPostgresUrl,
    schema: env.dbPostgresSchema,
    poolSize: env.dbPoolSize,
    poolMaxUses: env.dbPoolMaxUses,
    poolIdleTimeoutMs: env.dbPoolIdleTimeoutMs,
  })
  const cfg = DaemonConfig.readEnv({
    version: env.version,
    dbPostgresUrl: env.dbPostgresUrl,
    dbPostgresSchema: env.dbPostgresSchema,
  })
  const daemon = BskyDaemon.create({ db, cfg })
  await daemon.start()
  process.on('SIGTERM', async () => {
    await daemon.destroy()
  })
}

const getEnv = () => ({
  version: process.env.BSKY_VERSION,
  dbPostgresUrl:
    process.env.DB_PRIMARY_POSTGRES_URL || process.env.DB_POSTGRES_URL,
  dbPostgresSchema: process.env.DB_POSTGRES_SCHEMA || undefined,
  dbPoolSize: maybeParseInt(process.env.DB_POOL_SIZE),
  dbPoolMaxUses: maybeParseInt(process.env.DB_POOL_MAX_USES),
  dbPoolIdleTimeoutMs: maybeParseInt(process.env.DB_POOL_IDLE_TIMEOUT_MS),
})

const maybeParseInt = (str) => {
  const parsed = parseInt(str)
  return isNaN(parsed) ? undefined : parsed
}

main()
