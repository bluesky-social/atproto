import type { IncomingMessage } from 'node:http'
import type express from 'express'
import { type AuthVerifier, EntrywayRelayTokenError } from './auth-verifier.js'
import { httpLogger } from './logger.js'

const ENTRYWAY_RELAY_HEADER = 'x-entryway-relay'

const entrywayServiceRequests = new WeakSet<IncomingMessage>()

/**
 * Whether {@link entrywayAttribution} found a valid entryway service JWT on
 * the request.
 */
export const isEntrywayServiceRequest = (req: IncomingMessage): boolean =>
  entrywayServiceRequests.has(req)

/**
 * Attributes requests to the entryway, and to the users it proxies, by the
 * tokens it signs rather than by IP address. The rate limiters read `req.ip`
 * and decide on bypass synchronously, and on methods the PDS proxies they run
 * before anything authenticates the request, so the tokens are verified here,
 * ahead of the XRPC router.
 */
export const entrywayAttribution =
  (authVerifier: AuthVerifier): express.RequestHandler =>
  async (req, _res, next) => {
    const relayToken = req.headers[ENTRYWAY_RELAY_HEADER]
    if (typeof relayToken === 'string') {
      try {
        const clientIp = await authVerifier.verifyEntrywayRelayToken(relayToken)
        // Shadows express's "ip" getter so that everything reading req.ip
        // (rate limit keys, x-forwarded-for to the entryway) sees the client.
        Object.defineProperty(req, 'ip', {
          value: clientIp,
          configurable: true,
          enumerable: true,
        })
      } catch (err) {
        // Never fatal: the request stays attributed to its actual source. Only
        // the reason is logged, as the token itself carries the client's IP.
        const reason =
          err instanceof EntrywayRelayTokenError ? err.reason : 'error'
        httpLogger.debug({ reason }, 'ignoring invalid entryway relay token')
      }
    }

    if (await authVerifier.isEntrywayServiceRequest(req)) {
      entrywayServiceRequests.add(req)
    }

    next()
  }
