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
  // Migrate using credentialed user
  const migrateDb = Database.postgres({
    url: env.dbMigratePostgresUrl,
    schema: env.dbPostgresSchema,
    poolSize: 2,
  })
  await migrateDb.migrateToLatestOrThrow()
  await migrateDb.close()
  const db = Database.postgres({
    url: env.dbPostgresUrl,
    schema: env.dbPostgresSchema,
    poolSize: env.dbPoolSize,
    poolMaxUses: env.dbPoolMaxUses,
    poolIdleTimeoutMs: env.dbPoolIdleTimeoutMs,
  })
  const redis = new Redis(env.redisUrl)
  const cfg = IngesterConfig.readEnv({
    version: env.version,
    redisUrl: env.redisUrl,
    dbPostgresUrl: env.dbPostgresUrl,
    dbPostgresSchema: env.dbPostgresSchema,
    repoProvider: env.repoProvider,
    ingesterSubLockId: env.subLockId,
  })
  const ingester = BskyIngester.create({ db, redis, cfg })
  await ingester.start()
  process.on('SIGTERM', async () => {
    await ingester.destroy()
  })
}

// Also accepts the following in readEnv():
// - REPO_PROVIDER
// - INGESTER_PARTITION_COUNT
// - INGESTER_SUB_LOCK_ID
const getEnv = () => ({
  version: process.env.BSKY_VERSION,
  redisUrl: process.env.REDIS_URL,
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
