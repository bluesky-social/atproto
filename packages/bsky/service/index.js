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
const { Database, ServerConfig, BskyAppView } = require('@atproto/bsky')

const main = async () => {
  const env = getEnv()
  // Migrate using credentialed user
  const migrateDb = Database.postgres({
    url: pgUrl(env.dbMigrateCreds),
    schema: env.dbSchema,
  })
  await migrateDb.migrateToLatestOrThrow()
  await migrateDb.close()
  // Use lower-credentialed user to run the app
  const db = Database.postgres({
    url: pgUrl(env.dbCreds),
    schema: env.dbSchema,
  })
  const cfg = ServerConfig.readEnv({
    port: env.port,
    version: env.version,
    repoProvider: env.repoProvider,
    dbPostgresUrl: pgUrl(env.dbCreds),
    dbPostgresSchema: env.dbSchema,
    publicUrl: env.publicUrl,
    didPlcUrl: env.didPlcUrl,
    imgUriSalt: env.imgUriSalt,
    imgUriKey: env.imgUriKey,
    imgUriEndpoint: env.imgUriEndpoint,
    blobCacheLocation: env.blobCacheLocation,
  })
  const bsky = BskyAppView.create({ db, config: cfg })
  await bsky.start()
  // Graceful shutdown (see also https://aws.amazon.com/blogs/containers/graceful-shutdowns-with-ecs/)
  process.on('SIGTERM', async () => {
    await bsky.destroy()
  })
}

const pgUrl = ({ username, password, host, port }) => {
  const enc = encodeURIComponent
  return `postgresql://${username}:${enc(password)}@${host}:${port}/postgres`
}

const getEnv = () => ({
  port: parseInt(process.env.PORT),
  version: process.env.BSKY_VERSION,
  repoProvider: process.env.REPO_PROVIDER,
  dbCreds: JSON.parse(process.env.DB_CREDS_JSON),
  dbMigrateCreds: JSON.parse(process.env.DB_MIGRATE_CREDS_JSON),
  dbSchema: process.env.DB_SCHEMA,
  publicUrl: process.env.PUBLIC_URL,
  didPlcUrl: process.env.DID_PLC_URL,
  imgUriSalt: process.env.IMG_URI_SALT,
  imgUriKey: process.env.IMG_URI_KEY,
  imgUriEndpoint: process.env.IMG_URI_ENDPOINT,
  blobCacheLocation: process.env.BLOB_CACHE_LOC,
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
