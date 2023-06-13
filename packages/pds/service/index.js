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
const { KmsKeypair, S3BlobStore } = require('@atproto/aws')
const { Database, ServerConfig, PDS, DiskBlobStore } = require('@atproto/pds')
const { Secp256k1Keypair } = require('@atproto/crypto')

const main = async () => {
  const env = ServerConfig.getEnv()
  const config = new ServerConfig(env)

  // Migrate using credentialed user
  const migrateDb = getMigrationDb(config)
  await migrateDb.migrateToLatestOrThrow()
  await migrateDb.close()

  // @TODO config for keys
  const repoSigningKey = await Secp256k1Keypair.import(env.repoSigningKey)
  const plcRotationKey = await KmsKeypair.load({
    keyId: env.plcRotationKeyId,
  })

  const pds = PDS.create({
    config,
    db: getDb(config),
    blobstore: getBlobstore(config),
    repoSigningKey,
    plcRotationKey,
  })
  
  await pds.start()
  // Graceful shutdown (see also https://aws.amazon.com/blogs/containers/graceful-shutdowns-with-ecs/)
  process.on('SIGTERM', async () => {
    await pds.destroy()
  })
}

const getDb = (config) => {
  if (config.db.dialect === 'pg') {
    return Database.postgres({
      url: config.db.url,
      schema: config.db.schema,
      poolSize: config.db.poolSize,
      poolMaxUses: config.db.poolMaxUses,
      poolIdleTimeoutMs: config.db.poolIdleTimeoutMs,
    })
  } else {
    return Database.sqlite(config.db.location)
  }
}

const getMigrationDb = (config) => {
  if (config.db.dialect === 'pg') {
    return Database.postgres({
      url: config.db.migrationUrl,
      schema: config.db.schema,
    })
  } else {
    return Database.sqlite(config.db.location)
  }
}

const getBlobstore = (config) => {
  if (config.blobstore.provider === 's3') {
    return new S3BlobStore({ bucket: config.blobstore.bucket })
  } else {
    return new DiskBlobStore(
      config.blobstore.location,
      config.blobstore.tempLocation,
      config.blobstore.quarantineLocation
    )
  }
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

main()
