import { Agent, Dispatcher, Pool, RetryAgent } from 'undici'
import { isUnicastIp, unicastLookup } from '@atproto-labs/fetch-node'
import { ServerConfig } from '../config'
import { RETRYABLE_HTTP_STATUS_CODES } from '../util/retry'

export function createBlobDispatcher(cfg: ServerConfig): Dispatcher {
  const baseDispatcher = new Agent({
    allowH2: cfg.proxyAllowHTTP2, // This is experimental
    headersTimeout: cfg.proxyHeadersTimeout,
    maxResponseSize: cfg.proxyMaxResponseSize,
    bodyTimeout: cfg.proxyBodyTimeout,
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
          return new Pool(origin, opts)
        },
    connect: {
      lookup: cfg.disableSsrfProtection ? undefined : unicastLookup,
    },
  })

  return cfg.proxyMaxRetries > 0
    ? new RetryAgent(baseDispatcher, {
        statusCodes: [...RETRYABLE_HTTP_STATUS_CODES],
        methods: ['GET', 'HEAD'],
        maxRetries: cfg.proxyMaxRetries,
      })
    : baseDispatcher
}
