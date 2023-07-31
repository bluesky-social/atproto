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
const {
  KmsKeypair,
  S3BlobStore,
  CloudfrontInvalidator,
} = require('@atproto/aws')
const {
  Database,
  ServerConfig,
  PDS,
  ViewMaintainer,
  makeAlgos,
} = require('@atproto/pds')
const { Secp256k1Keypair } = require('@atproto/crypto')

const main = async () => {
  const env = getEnv()
  // Migrate using credentialed user
  const migrateDb = Database.postgres({
    url: pgUrl(env.dbMigrateCreds),
    schema: env.dbSchema,
    // We need one connection for the
    // view-maintainer lock then one for anything else.
    poolSize: 2,
  })
  await migrateDb.migrateToLatestOrThrow()
  // Use lower-credentialed user to run the app
  const db = Database.postgres({
    url: pgUrl(env.dbCreds),
    schema: env.dbSchema,
    poolSize: env.dbPoolSize,
    poolMaxUses: env.dbPoolMaxUses,
    poolIdleTimeoutMs: env.dbPoolIdleTimeoutMs,
  })
  const s3Blobstore = new S3BlobStore({ bucket: env.s3Bucket })
  const repoSigningKey = await Secp256k1Keypair.import(env.repoSigningKey)
  const plcRotationKey = await KmsKeypair.load({
    keyId: env.plcRotationKeyId,
  })
  let recoveryKey
  if (env.recoveryKeyId.startsWith('did:')) {
    recoveryKey = env.recoveryKeyId
  } else {
    const recoveryKeypair = await KmsKeypair.load({
      keyId: env.recoveryKeyId,
    })
    recoveryKey = recoveryKeypair.did()
  }
  const cfg = ServerConfig.readEnv({
    port: env.port,
    recoveryKey,
    emailSmtpUrl: smtpUrl({
      host: env.smtpHost,
      username: env.smtpUsername,
      password: env.smtpPassword,
    }),
  })
  const cfInvalidator = new CloudfrontInvalidator({
    distributionId: env.cfDistributionId,
    pathPrefix: cfg.imgUriEndpoint && new URL(cfg.imgUriEndpoint).pathname,
  })
  const algos = env.feedPublisherDid ? makeAlgos(env.feedPublisherDid) : {}
  const pds = PDS.create({
    db,
    blobstore: s3Blobstore,
    repoSigningKey,
    plcRotationKey,
    config: cfg,
    imgInvalidator: cfInvalidator,
    algos,
  })
  const viewMaintainer = new ViewMaintainer(migrateDb)
  const viewMaintainerRunning = viewMaintainer.run()
  await pds.start()
  // Graceful shutdown (see also https://aws.amazon.com/blogs/containers/graceful-shutdowns-with-ecs/)
  process.on('SIGTERM', async () => {
    await pds.destroy()
    viewMaintainer.destroy()
    await viewMaintainerRunning
    await migrateDb.close()
  })
}

const pgUrl = ({
  username = 'postgres',
  password = 'postgres',
  host = '0.0.0.0',
  port = '5432',
  database = 'postgres',
  sslmode,
}) => {
  const enc = encodeURIComponent
  return `postgresql://${username}:${enc(
    password,
  )}@${host}:${port}/${database}${sslmode ? `?sslmode=${enc(sslmode)}` : ''}`
}

const smtpUrl = ({ username, password, host }) => {
  const enc = encodeURIComponent
  return `smtps://${username}:${enc(password)}@${host}`
}

const maybeParseInt = (str) => {
  const parsed = parseInt(str)
  return isNaN(parsed) ? undefined : parsed
}

const getEnv = () => ({
  port: parseInt(process.env.PORT),
  plcRotationKeyId: process.env.PLC_ROTATION_KEY_ID,
  repoSigningKey: process.env.REPO_SIGNING_KEY,
  recoveryKeyId: process.env.RECOVERY_KEY_ID,
  dbCreds: JSON.parse(process.env.DB_CREDS_JSON),
  dbMigrateCreds: JSON.parse(process.env.DB_MIGRATE_CREDS_JSON),
  dbSchema: process.env.DB_SCHEMA || undefined,
  dbPoolSize: maybeParseInt(process.env.DB_POOL_SIZE),
  dbPoolMaxUses: maybeParseInt(process.env.DB_POOL_MAX_USES),
  dbPoolIdleTimeoutMs: maybeParseInt(process.env.DB_POOL_IDLE_TIMEOUT_MS),
  smtpHost: process.env.SMTP_HOST,
  smtpUsername: process.env.SMTP_USERNAME,
  smtpPassword: process.env.SMTP_PASSWORD,
  s3Bucket: process.env.S3_BUCKET_NAME,
  cfDistributionId: process.env.CF_DISTRIBUTION_ID,
  feedPublisherDid: process.env.FEED_PUBLISHER_DID,
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
