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
<<<<<<< HEAD
const {
  PDS,
  Database,
  envToCfg,
  envToSecrets,
  readEnv,
  httpLogger,
=======
const { KmsKeypair, S3BlobStore } = require('@atproto/aws')
const {
  Database,
  ServerConfig,
  PDS,
  ViewMaintainer,
>>>>>>> main
  PeriodicModerationActionReversal,
} = require('@atproto/pds')
const pkg = require('@atproto/pds/package.json')

const main = async () => {
  const env = readEnv()
  env.version ||= pkg.version
  const cfg = envToCfg(env)
  const secrets = envToSecrets(env)
  const pds = await PDS.create(cfg, secrets)
  if (cfg.db.dialect === 'pg') {
    // Migrate using credentialed user
    const migrateDb = Database.postgres({
      url: cfg.db.migrationUrl,
      schema: cfg.db.schema,
    })
    await migrateDb.migrateToLatestOrThrow()
    await migrateDb.close()
  } else {
    await pds.ctx.db.migrateToLatestOrThrow()
  }
<<<<<<< HEAD
=======
  const cfg = ServerConfig.readEnv({
    port: env.port,
    recoveryKey,
    emailSmtpUrl: smtpUrl({
      host: env.smtpHost,
      username: env.smtpUsername,
      password: env.smtpPassword,
    }),
  })
  const pds = PDS.create({
    db,
    blobstore: s3Blobstore,
    repoSigningKey,
    plcRotationKey,
    config: cfg,
  })
  const viewMaintainer = new ViewMaintainer(migrateDb)
  const viewMaintainerRunning = viewMaintainer.run()
>>>>>>> main

  // If the PDS is configured to proxy moderation, this will be running on appview instead of pds.
  // Also don't run this on the sequencer leader, which may not be configured regarding moderation proxying at all.
  const periodicModerationActionReversal =
    pds.cfg.bskyAppView.proxyModeration || pds.ctx.cfg.sequencerLeaderEnabled
      ? null
      : new PeriodicModerationActionReversal(pds.ctx)
  const periodicModerationActionReversalRunning =
    periodicModerationActionReversal?.run()

  await pds.start()

  httpLogger.info('pds is running')
  // Graceful shutdown (see also https://aws.amazon.com/blogs/containers/graceful-shutdowns-with-ecs/)
  process.on('SIGTERM', async () => {
    httpLogger.info('pds is stopping')

    periodicModerationActionReversal?.destroy()
    await periodicModerationActionReversalRunning

    await pds.destroy()

    httpLogger.info('pds is stopped')
  })
}

<<<<<<< HEAD
=======
const pgUrl = ({
  username = 'postgres',
  password = 'postgres',
  host = 'localhost',
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
})

>>>>>>> main
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
