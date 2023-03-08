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
const { S3BlobStore, CloudfrontInvalidator } = require('@atproto/aws')
const { Database, ServerConfig, Bsky } = require('@atproto/bsky')

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
  const s3Blobstore = new S3BlobStore({ bucket: env.s3Bucket })
  const cfInvalidator = new CloudfrontInvalidator({
    distributionId: env.cfDistributionId,
  })
  const cfg = ServerConfig.readEnv({
    port: env.port,
    emailSmtpUrl: smtpUrl({
      host: env.smtpHost,
      username: env.smtpUsername,
      password: env.smtpPassword,
    }),
  })
  const bsky = Bsky.create({
    db,
    blobstore: s3Blobstore,
    config: cfg,
    imgInvalidator: cfInvalidator,
  })
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
  dbCreds: JSON.parse(process.env.DB_CREDS_JSON),
  dbMigrateCreds: JSON.parse(process.env.DB_MIGRATE_CREDS_JSON),
  dbSchema: process.env.DB_SCHEMA,
  s3Bucket: process.env.S3_BUCKET_NAME,
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
