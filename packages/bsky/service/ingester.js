'use strict' /* eslint-disable */

require('dd-trace/init') // Only works with commonjs

// Tracer code above must come before anything else
const {
  Database,
  IngesterConfig,
  BskyIngester,
  Redis,
} = require('@atproto/bsky')

const main = async () => {
  const env = getEnv()
  // No migration: ingester only uses pg for a lock
  const db = Database.postgres({
    url: env.dbPostgresUrl,
    schema: env.dbPostgresSchema,
    poolSize: env.dbPoolSize,
    poolMaxUses: env.dbPoolMaxUses,
    poolIdleTimeoutMs: env.dbPoolIdleTimeoutMs,
  })
  const cfg = IngesterConfig.readEnv({
    version: env.version,
    dbPostgresUrl: env.dbPostgresUrl,
    dbPostgresSchema: env.dbPostgresSchema,
    repoProvider: env.repoProvider,
    ingesterSubLockId: env.subLockId,
  })
  const redis = new Redis(
    cfg.redisSentinelName
      ? {
          sentinel: cfg.redisSentinelName,
          hosts: cfg.redisSentinelHosts,
          password: cfg.redisPassword,
        }
      : {
          host: cfg.redisHost,
          password: cfg.redisPassword,
        },
  )
  const ingester = BskyIngester.create({ db, redis, cfg })
  await ingester.start()
  process.on('SIGTERM', async () => {
    await ingester.destroy()
  })
}

// Also accepts the following in readEnv():
// - REDIS_HOST
// - REDIS_SENTINEL_NAME
// - REDIS_SENTINEL_HOSTS
// - REDIS_PASSWORD
// - REPO_PROVIDER
// - INGESTER_PARTITION_COUNT
// - INGESTER_MAX_ITEMS
// - INGESTER_CHECK_ITEMS_EVERY_N
// - INGESTER_INITIAL_CURSOR
// - INGESTER_SUB_LOCK_ID
const getEnv = () => ({
  version: process.env.BSKY_VERSION,
  dbPostgresUrl: process.env.DB_POSTGRES_URL,
  dbMigratePostgresUrl:
    process.env.DB_MIGRATE_POSTGRES_URL || process.env.DB_POSTGRES_URL,
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
