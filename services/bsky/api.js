'use strict' /* eslint-disable */

require('dd-trace') // Only works with commonjs
  .init({ logInjection: true })
  .tracer.use('express', {
    hooks: {
      request: (span, req) => {
        maintainXrpcResource(span, req)
      },
    },
  })

// Tracer code above must come before anything else
const path = require('path')
const assert = require('assert')
const cluster = require('cluster')
const {
  BunnyInvalidator,
  CloudfrontInvalidator,
  MultiImageInvalidator,
} = require('@atproto/aws')
const { Secp256k1Keypair } = require('@atproto/crypto')
const {
  DatabaseCoordinator,
  PrimaryDatabase,
  Redis,
  ServerConfig,
  BskyAppView,
  makeAlgos,
  PeriodicModerationEventReversal,
} = require('@atproto/bsky')

const main = async () => {
  const env = getEnv()
  assert(env.dbPrimaryPostgresUrl, 'missing configuration for db')

  if (env.enableMigrations) {
    // separate db needed for more permissions
    const migrateDb = new PrimaryDatabase({
      url: env.dbMigratePostgresUrl,
      schema: env.dbPostgresSchema,
      poolSize: 2,
    })
    await migrateDb.migrateToLatestOrThrow()
    await migrateDb.close()
  }

  const db = new DatabaseCoordinator({
    schema: env.dbPostgresSchema,
    primary: {
      url: env.dbPrimaryPostgresUrl,
      poolSize: env.dbPrimaryPoolSize || env.dbPoolSize,
      poolMaxUses: env.dbPoolMaxUses,
      poolIdleTimeoutMs: env.dbPoolIdleTimeoutMs,
    },
    replicas: env.dbReplicaPostgresUrls?.map((url, i) => {
      return {
        url,
        poolSize: env.dbPoolSize,
        poolMaxUses: env.dbPoolMaxUses,
        poolIdleTimeoutMs: env.dbPoolIdleTimeoutMs,
        tags: getTagsForIdx(env.dbReplicaTags, i),
      }
    }),
  })
  const cfg = ServerConfig.readEnv({
    port: env.port,
    version: env.version,
    dbPrimaryPostgresUrl: env.dbPrimaryPostgresUrl,
    dbReplicaPostgresUrls: env.dbReplicaPostgresUrls,
    dbReplicaTags: env.dbReplicaTags,
    dbPostgresSchema: env.dbPostgresSchema,
    publicUrl: env.publicUrl,
    didPlcUrl: env.didPlcUrl,
    imgUriSalt: env.imgUriSalt,
    imgUriKey: env.imgUriKey,
    imgUriEndpoint: env.imgUriEndpoint,
    blobCacheLocation: env.blobCacheLocation,
  })

  const redis = new Redis(
    cfg.redisSentinelName
      ? {
          sentinel: cfg.redisSentinelName,
          hosts: cfg.redisSentinelHosts,
          password: cfg.redisPassword,
          db: 1,
          commandTimeout: 500,
        }
      : {
          host: cfg.redisHost,
          password: cfg.redisPassword,
          db: 1,
          commandTimeout: 500,
        },
  )

  const signingKey = await Secp256k1Keypair.import(env.serviceSigningKey)

  // configure zero, one, or more image invalidators
  const imgInvalidators = []

  if (env.bunnyAccessKey) {
    imgInvalidators.push(
      new BunnyInvalidator({
        accessKey: env.bunnyAccessKey,
        urlPrefix: cfg.imgUriEndpoint,
      }),
    )
  }

  if (env.cfDistributionId) {
    imgInvalidators.push(
      new CloudfrontInvalidator({
        distributionId: env.cfDistributionId,
        pathPrefix: cfg.imgUriEndpoint && new URL(cfg.imgUriEndpoint).pathname,
      }),
    )
  }

  const imgInvalidator =
    imgInvalidators.length > 1
      ? new MultiImageInvalidator(imgInvalidators)
      : imgInvalidators[0]

  const algos = env.feedPublisherDid ? makeAlgos(env.feedPublisherDid) : {}
  const bsky = BskyAppView.create({
    db,
    redis,
    signingKey,
    config: cfg,
    imgInvalidator,
    algos,
  })

  const periodicModerationEventReversal = new PeriodicModerationEventReversal(
    bsky.ctx,
  )
  const periodicModerationEventReversalRunning =
    periodicModerationEventReversal.run()

  await bsky.start()
  // Graceful shutdown (see also https://aws.amazon.com/blogs/containers/graceful-shutdowns-with-ecs/)
  const shutdown = async () => {
    // Gracefully shutdown periodic-moderation-event-reversal before destroying bsky instance
    periodicModerationEventReversal.destroy()
    await periodicModerationEventReversalRunning
    await bsky.destroy()
  }
  process.on('SIGTERM', shutdown)
  process.on('disconnect', shutdown) // when clustering
}

const getEnv = () => ({
  enableMigrations: process.env.ENABLE_MIGRATIONS === 'true',
  port: parseInt(process.env.PORT),
  version: process.env.BSKY_VERSION,
  dbMigratePostgresUrl:
    process.env.DB_MIGRATE_POSTGRES_URL || process.env.DB_PRIMARY_POSTGRES_URL,
  dbPrimaryPostgresUrl: process.env.DB_PRIMARY_POSTGRES_URL,
  dbPrimaryPoolSize: maybeParseInt(process.env.DB_PRIMARY_POOL_SIZE),
  dbReplicaPostgresUrls: process.env.DB_REPLICA_POSTGRES_URLS
    ? process.env.DB_REPLICA_POSTGRES_URLS.split(',')
    : undefined,
  dbReplicaTags: {
    '*': getTagIdxs(process.env.DB_REPLICA_TAGS_ANY), // e.g. DB_REPLICA_TAGS_ANY=0,1
    timeline: getTagIdxs(process.env.DB_REPLICA_TAGS_TIMELINE),
    feed: getTagIdxs(process.env.DB_REPLICA_TAGS_FEED),
    search: getTagIdxs(process.env.DB_REPLICA_TAGS_SEARCH),
    thread: getTagIdxs(process.env.DB_REPLICA_TAGS_THREAD),
  },
  dbPostgresSchema: process.env.DB_POSTGRES_SCHEMA || undefined,
  dbPoolSize: maybeParseInt(process.env.DB_POOL_SIZE),
  dbPoolMaxUses: maybeParseInt(process.env.DB_POOL_MAX_USES),
  dbPoolIdleTimeoutMs: maybeParseInt(process.env.DB_POOL_IDLE_TIMEOUT_MS),
  serviceSigningKey: process.env.SERVICE_SIGNING_KEY,
  publicUrl: process.env.PUBLIC_URL,
  didPlcUrl: process.env.DID_PLC_URL,
  imgUriSalt: process.env.IMG_URI_SALT,
  imgUriKey: process.env.IMG_URI_KEY,
  imgUriEndpoint: process.env.IMG_URI_ENDPOINT,
  blobCacheLocation: process.env.BLOB_CACHE_LOC,
  bunnyAccessKey: process.env.BUNNY_ACCESS_KEY,
  cfDistributionId: process.env.CF_DISTRIBUTION_ID,
  feedPublisherDid: process.env.FEED_PUBLISHER_DID,
})

/**
 * @param {Record<string, number[]>} tags
 * @param {number} idx
 */
const getTagsForIdx = (tagMap, idx) => {
  const tags = []
  for (const [tag, indexes] of Object.entries(tagMap)) {
    if (indexes.includes(idx)) {
      tags.push(tag)
    }
  }
  return tags
}

/**
 * @param {string} str
 */
const getTagIdxs = (str) => {
  return str ? str.split(',').map((item) => parseInt(item, 10)) : []
}

const maybeParseInt = (str) => {
  const parsed = parseInt(str)
  return isNaN(parsed) ? undefined : parsed
}

const maintainXrpcResource = (span, req) => {
  // Show actual xrpc method as resource rather than the route pattern
  if (span && req.originalUrl?.startsWith('/xrpc/')) {
    span.setTag(
      'resource.name',
      [
        req.method,
        path.posix.join(req.baseUrl || '', req.path || '', '/').slice(0, -1), // Ensures no trailing slash
      ]
        .filter(Boolean)
        .join(' '),
    )
  }
}

const workerCount = maybeParseInt(process.env.CLUSTER_WORKER_COUNT)

if (workerCount) {
  if (cluster.isPrimary) {
    console.log(`primary ${process.pid} is running`)
    const workers = new Set()
    for (let i = 0; i < workerCount; ++i) {
      workers.add(cluster.fork())
    }
    let teardown = false
    cluster.on('exit', (worker) => {
      workers.delete(worker)
      if (!teardown) {
        workers.add(cluster.fork()) // restart on crash
      }
    })
    process.on('SIGTERM', () => {
      teardown = true
      console.log('disconnecting workers')
      workers.forEach((w) => w.disconnect())
    })
  } else {
    console.log(`worker ${process.pid} is running`)
    main()
  }
} else {
  main() // non-clustering
}
