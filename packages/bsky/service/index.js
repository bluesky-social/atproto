'use strict' /* eslint-disable */

require('dd-trace/init') // Only works with commonjs
  .tracer.use('express', {
    hooks: {
      request: (span, req) => {
        maintainXrpcResource(span, req)
      },
    },
  })

// Tracer code above must come before anything else
const path = require('path')
const { CloudfrontInvalidator } = require('@atproto/aws')
const { Database, ServerConfig, BskyAppView } = require('@atproto/bsky')

const main = async () => {
  const env = getEnv()
  // Migrate using credentialed user
  const migrateDb = Database.postgres({
    url: env.dbMigratePostgresUrl,
    schema: env.dbPostgresSchema,
  })
  await migrateDb.migrateToLatestOrThrow()
  await migrateDb.close()
  // Use lower-credentialed user to run the app
  const db = Database.postgres({
    url: env.dbPostgresUrl,
    schema: env.dbSchema,
  })
  const cfg = ServerConfig.readEnv({
    port: env.port,
    version: env.version,
    repoProvider: env.repoProvider,
    dbPostgresUrl: env.dbPostgresUrl,
    dbPostgresSchema: env.dbPostgresSchema,
    publicUrl: env.publicUrl,
    didPlcUrl: env.didPlcUrl,
    imgUriSalt: env.imgUriSalt,
    imgUriKey: env.imgUriKey,
    imgUriEndpoint: env.imgUriEndpoint,
    blobCacheLocation: env.blobCacheLocation,
  })
  const cfInvalidator = env.cfDistributionId
    ? new CloudfrontInvalidator({
        distributionId: env.cfDistributionId,
        pathPrefix: cfg.imgUriEndpoint && new URL(cfg.imgUriEndpoint).pathname,
      })
    : undefined
  const bsky = BskyAppView.create({
    db,
    config: cfg,
    imgInvalidator: cfInvalidator,
  })
  await bsky.start()
  // Graceful shutdown (see also https://aws.amazon.com/blogs/containers/graceful-shutdowns-with-ecs/)
  process.on('SIGTERM', async () => {
    await bsky.destroy()
  })
}

const getEnv = () => ({
  port: parseInt(process.env.PORT),
  version: process.env.BSKY_VERSION,
  repoProvider: process.env.REPO_PROVIDER,
  dbPostgresUrl: process.env.DB_POSTGRES_URL,
  dbMigratePostgresUrl:
    process.env.DB_MIGRATE_POSTGRES_URL || process.env.DB_POSTGRES_URL,
  dbPostgresSchema: process.env.DB_POSTGRES_SCHEMA || undefined,
  publicUrl: process.env.PUBLIC_URL,
  didPlcUrl: process.env.DID_PLC_URL,
  imgUriSalt: process.env.IMG_URI_SALT,
  imgUriKey: process.env.IMG_URI_KEY,
  imgUriEndpoint: process.env.IMG_URI_ENDPOINT,
  blobCacheLocation: process.env.BLOB_CACHE_LOC,
  cfDistributionId: process.env.CF_DISTRIBUTION_ID,
})

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

main()
