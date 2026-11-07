import { Agent, type Dispatcher, Pool, interceptors } from 'undici'
import { isUnicastIp, unicastLookup } from '@atproto-labs/fetch-node'
import type { ServerConfig } from '../config.js'
import { RETRYABLE_HTTP_STATUS_CODES } from '../util/retry.js'

export function createBlobDispatcher(cfg: ServerConfig): Dispatcher {
  const baseDispatcher = new Agent({
    allowH2: cfg.proxyAllowHTTP2, // This is experimental
    connectTimeout: cfg.proxyConnectTimeout,
    headersTimeout: cfg.proxyHeadersTimeout,
    maxResponseSize: cfg.proxyMaxResponseSize,
    bodyTimeout: cfg.proxyBodyTimeout,
    // These optional values preserve the library's unbounded defaults unless an
    // operator explicitly configures a cap. `connections` is an Agent option that
    // is forwarded to the per-origin Pool, `maxOrigins` is enforced by the Agent.
    connections: cfg.proxyPoolConnections,
    maxOrigins: cfg.proxyMaxOrigins,
    factory: cfg.disableSsrfProtection
      ? undefined
      : (origin, opts) => {
          const { protocol, hostname } =
            origin instanceof URL ? origin : new URL(origin)
          if (protocol !== 'https:') {
            throw new Error(`Forbidden protocol "${protocol}"`)
          }
          if (isUnicastIp(hostname) === false) {
            throw new Error('Hostname resolved to non-unicast address')
          }
          // `opts` already carries `connections` and `maxOrigins` from the Agent.
          // Pool has no `maxOrigins` option (it is Agent-level only), so pass it
          // through untouched rather than declaring it on Pool explicitly.
          return new Pool(origin, {
            ...opts,
            connections: cfg.proxyPoolConnections,
          })
        },
    connect: {
      lookup: cfg.disableSsrfProtection ? undefined : unicastLookup,
    },
  })

  return baseDispatcher.compose(
    interceptors.redirect({
      maxRedirections: 10,
      throwOnMaxRedirect: true,
    }),
    interceptors.retry({
      statusCodes: [...RETRYABLE_HTTP_STATUS_CODES].filter(
        (statusCode) => statusCode !== 429,
      ),
      methods: ['GET', 'HEAD'],
      maxRetries: cfg.proxyMaxRetries,
    }),
    interceptors.retry({
      statusCodes: [429],
      errorCodes: [],
      methods: ['GET', 'HEAD'],
      maxRetries: 0,
    }),
  )
}
