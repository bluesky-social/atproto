/* eslint-env node */

'use strict'

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
const path = require('node:path')
const {
  BunnyInvalidator,
  CloudfrontInvalidator,
  MultiImageInvalidator,
} = require('@atproto/aws')
const {
  Database,
  OzoneService,
  envToCfg,
  envToSecrets,
  httpLogger,
  readEnv,
} = require('@atproto/ozone')

const main = async () => {
  const env = readEnv()
  const cfg = envToCfg(env)
  const secrets = envToSecrets(env)

  // configure zero, one, or more image invalidators
  const imgUriEndpoint = process.env.OZONE_IMG_URI_ENDPOINT
  const bunnyAccessKey = process.env.OZONE_BUNNY_ACCESS_KEY
  const cfDistributionId = process.env.OZONE_CF_DISTRIBUTION_ID

  const imgInvalidators = []

  if (bunnyAccessKey) {
    imgInvalidators.push(
      new BunnyInvalidator({
        accessKey: bunnyAccessKey,
        urlPrefix: imgUriEndpoint,
      }),
    )
  }

  if (cfDistributionId) {
    imgInvalidators.push(
      new CloudfrontInvalidator({
        distributionId: cfDistributionId,
        pathPrefix: imgUriEndpoint && new URL(imgUriEndpoint).pathname,
      }),
    )
  }

  const imgInvalidator =
    imgInvalidators.length > 1
      ? new MultiImageInvalidator(imgInvalidators)
      : imgInvalidators[0]

  const migrate = process.env.OZONE_DB_MIGRATE === '1'
  if (migrate) {
    const db = new Database({
      url: cfg.db.postgresUrl,
      schema: cfg.db.postgresSchema,
    })
    await db.migrateToLatestOrThrow()
    await db.close()
  }

  const ozone = await OzoneService.create(cfg, secrets, { imgInvalidator })

  await ozone.start()

  httpLogger.info('ozone is running')

  // Graceful shutdown (see also https://aws.amazon.com/blogs/containers/graceful-shutdowns-with-ecs/)
  process.on('SIGTERM', async () => {
    httpLogger.info('ozone is stopping')

    await ozone.destroy()

    httpLogger.info('ozone is stopped')
  })
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
