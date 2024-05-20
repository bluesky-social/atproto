/* eslint-env node */

'use strict'

const { registerInstrumentations } = require('@opentelemetry/instrumentation')

const {
  BetterSqlite3Instrumentation,
} = require('opentelemetry-plugin-better-sqlite3')

const { TracerProvider } = require('dd-trace') // Only works with commonjs
  .init({ logInjection: true })
  .use('express', {
    hooks: {
      request: (span, req) => {
        maintainXrpcResource(span, req)
      },
    },
  })

const tracer = new TracerProvider()
tracer.register()

registerInstrumentations({
  tracerProvider: tracer,
  instrumentations: [new BetterSqlite3Instrumentation()],
})

// Tracer code above must come before anything else
const path = require('path')
const {
  PDS,
  envToCfg,
  envToSecrets,
  readEnv,
  httpLogger,
} = require('@atproto/pds')
const pkg = require('@atproto/pds/package.json')

const main = async () => {
  const env = readEnv()
  env.version ??= pkg.version
  const cfg = envToCfg(env)
  const secrets = envToSecrets(env)
  const pds = await PDS.create(cfg, secrets)

  await pds.start()

  httpLogger.info('pds is running')
  // Graceful shutdown (see also https://aws.amazon.com/blogs/containers/graceful-shutdowns-with-ecs/)
  process.on('SIGTERM', async () => {
    httpLogger.info('pds is stopping')
    await pds.destroy()
    httpLogger.info('pds is stopped')
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
