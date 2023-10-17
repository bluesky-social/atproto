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
  PDS,
  envToCfg,
  envToSecrets,
  readEnv,
  httpLogger,
  PeriodicModerationActionReversal,
} = require('@atproto/pds')
const pkg = require('@atproto/pds/package.json')

const main = async () => {
  const env = readEnv()
  env.version ??= pkg.version
  const cfg = envToCfg(env)
  const secrets = envToSecrets(env)
  const pds = await PDS.create(cfg, secrets)

  // If the PDS is configured to proxy moderation, this will be running on appview instead of pds.
  // Also don't run this on the sequencer leader, which may not be configured regarding moderation proxying at all.
  const periodicModerationActionReversal =
    pds.ctx.cfg.bskyAppView.proxyModeration ||
    pds.ctx.cfg.sequencerLeaderEnabled
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
