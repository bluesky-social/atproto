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
  OzoneService,
  envToCfg,
  envToSecrets,
  readEnv,
  httpLogger,
} = require('@atproto/ozone')

const main = async () => {
  const env = readEnv()
  const cfg = envToCfg(env)
  const secrets = envToSecrets(env)
  const ozone = await OzoneService.create(cfg, secrets)

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
