'use strict' /* eslint-disable */

const dd = require('dd-trace')

// modify tracer in order to track calls to dataplane as a service with proper resource names
const DATAPLANE_PREFIX = '/bsky.Service/'
const origStartSpan = dd.tracer.startSpan
dd.tracer.startSpan = function (name, options) {
  if (
    name !== 'http.request' ||
    options?.tags?.component !== 'http2' ||
    !options?.tags?.['http.uri']
  ) {
    return origStartSpan.call(this, name, options)
  }
  const uri = new URL(options.tags['http.uri'])
  if (!uri.pathname.startsWith(DATAPLANE_PREFIX)) {
    return origStartSpan.call(this, name, options)
  }
  options.tags['service.name'] = 'dataplane-bsky'
  options.tags['resource.name'] = uri.pathname.slice(DATAPLANE_PREFIX.length)
  return origStartSpan.call(this, name, options)
}

dd.tracer
  .init()
  .use('http2', {
    client: true, // calls into dataplane
    server: false,
  })
  .use('express', {
    hooks: {
      request: (span, req) => {
        maintainXrpcResource(span, req)
      },
    },
  })

// Tracer code above must come before anything else
const path = require('node:path')
const assert = require('node:assert')
const { Secp256k1Keypair } = require('@atproto/crypto')
const { ServerConfig, BskyAppView, makeAlgos } = require('@atproto/bsky')
const { MemoryCache: MemoryDidCache } = require('@atproto/identity')

const main = async () => {
  const env = getEnv()
  const config = ServerConfig.readEnv()
  assert(env.serviceSigningKey, 'must set BSKY_SERVICE_SIGNING_KEY')
  const signingKey = await Secp256k1Keypair.import(env.serviceSigningKey)
  const algos = env.feedPublisherDid ? makeAlgos(env.feedPublisherDid) : {}
  const didCache = new MemoryDidCache() // @TODO persistent, shared cache
  const bsky = BskyAppView.create({
    config,
    signingKey,
    didCache,
    algos,
  })
  await bsky.start()
  process.on('SIGTERM', async () => {
    await bsky.destroy()
  })
}

const getEnv = () => ({
  serviceSigningKey: process.env.BSKY_SERVICE_SIGNING_KEY || undefined,
  feedPublisherDid: process.env.BSKY_FEED_PUBLISHER_DID || undefined,
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
