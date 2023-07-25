'use strict' /* eslint-disable */

require('dd-trace/init') // Only works with commonjs

// Tracer code above must come before anything else
const { Database, IndexerConfig, BskyIndexer, Redis } = require('@atproto/bsky')

const main = async () => {
  const env = getEnv()
  // Migrate using credentialed user
  // @TODO temporarily disabled for testing purposes
  // const migrateDb = Database.postgres({
  //   url: env.dbMigratePostgresUrl,
  //   schema: env.dbPostgresSchema,
  //   poolSize: 2,
  // })
  // await migrateDb.migrateToLatestOrThrow()
  // await migrateDb.close()
  const db = Database.postgres({
    url: env.dbPostgresUrl,
    schema: env.dbPostgresSchema,
    poolSize: env.dbPoolSize,
    poolMaxUses: env.dbPoolMaxUses,
    poolIdleTimeoutMs: env.dbPoolIdleTimeoutMs,
  })
  const cfg = IndexerConfig.readEnv({
    version: env.version,
    dbPostgresUrl: env.dbPostgresUrl,
    dbPostgresSchema: env.dbPostgresSchema,
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
  const indexer = BskyIndexer.create({ db, redis, cfg })
  await indexer.start()
  process.on('SIGTERM', async () => {
    await indexer.destroy()
  })
}

// Also accepts the following in readEnv():
//  - REDIS_HOST
//  - REDIS_SENTINEL_NAME
//  - REDIS_SENTINEL_HOSTS
//  - REDIS_PASSWORD
//  - DID_PLC_URL
//  - DID_CACHE_STALE_TTL
//  - DID_CACHE_MAX_TTL
//  - LABELER_DID
//  - HIVE_API_KEY
//  - INDEXER_PARTITION_IDS
//  - INDEXER_PARTITION_BATCH_SIZE
//  - INDEXER_CONCURRENCY
//  - INDEXER_SUB_LOCK_ID
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
