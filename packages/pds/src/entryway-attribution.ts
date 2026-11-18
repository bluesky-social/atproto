import type { KeyObject } from 'node:crypto'
import type express from 'express'
import * as jose from 'jose'
import type { HandlerContext } from '@atproto/xrpc-server'
import { httpLogger } from './logger.js'
import { canonicalIp } from './util/ip.js'

const ENTRYWAY_RELAY_HEADER = 'x-entryway-relay'

const ENTRYWAY_RELAY_TOKEN_MAX_LIFETIME_SEC = 2 * 60
const ENTRYWAY_RELAY_TOKEN_CLOCK_TOLERANCE_SEC = 30

export class EntrywayRelayTokenError extends Error {
  /**
   * @param reason Why the token was refused, as a short code (such as jose's
   * error code) so that logging it reveals nothing of the token or the client.
   */
  constructor(
    public readonly reason: string,
    options?: ErrorOptions,
  ) {
    super(`Invalid entryway relay token: ${reason}`, options)
  }
}

/**
 * Rate limit bypass for requests the entryway makes with its service JWT.
 * Routes authenticate requests before applying rate limits, so this relies on
 * the route having accepted the token rather than verifying it again.
 */
export const entrywayRateLimitBypass = ({ auth }: HandlerContext): boolean => {
  if (!auth) return false
  const credentials = auth.credentials as { type?: unknown }
  return credentials?.type === 'entryway_service'
}

/**
 * Attributes the user requests the entryway proxies to the users rather than
 * to the entryway, by the relay token it signs. The rate limiters key on
 * `req.ip`, and on methods the PDS proxies they run before anything
 * authenticates the request, so the token is verified here, ahead of the XRPC
 * router.
 */
export function entrywayAttribution(
  relayTokenOpts: EntrywayRelayTokenOptions,
): express.RequestHandler {
  return async (req, res, next) => {
    const relayToken = req.headers[ENTRYWAY_RELAY_HEADER]
    if (typeof relayToken === 'string') {
      try {
        const clientIp = await verifyEntrywayRelayToken(
          relayToken,
          relayTokenOpts,
        )
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

    next()
  }
}

type EntrywayRelayTokenOptions = {
  entrywayDid: string
  pdsDid: string
  key: KeyObject
}

/**
 * Verifies the relay token that the entryway attaches to the user requests it
 * proxies, and returns the client IP address it attests to, in canonical form.
 *
 * @throws {EntrywayRelayTokenError} if the token is not valid
 */
export async function verifyEntrywayRelayToken(
  token: string,
  opts: EntrywayRelayTokenOptions,
): Promise<string> {
  return jose
    .jwtVerify(token, opts.key, {
      algorithms: ['ES256K'],
      // Pinned so that access tokens ("at+jwt") are refused
      typ: 'JWT',
      issuer: opts.entrywayDid,
      audience: opts.pdsDid,
      requiredClaims: ['iat', 'exp', 'client_ip'],
      // Also refuses an "iat" in the future
      maxTokenAge: ENTRYWAY_RELAY_TOKEN_MAX_LIFETIME_SEC,
      clockTolerance: ENTRYWAY_RELAY_TOKEN_CLOCK_TOLERANCE_SEC,
    })
    .then(checkEntrywayRelayClaims, (err) => {
      const reason = err instanceof jose.errors.JOSEError ? err.code : 'error'
      throw new EntrywayRelayTokenError(reason, { cause: err })
    })
}

// Checks what jwtVerify() does not: "lxm" is refused so that a relay token and
// a service JWT can never stand in for each other, and "exp" may be at most 120
// seconds after "iat". Returns the attested client IP in canonical form.
function checkEntrywayRelayClaims({ payload }: jose.JWTVerifyResult): string {
  const { iat, exp, lxm, client_ip: clientIp } = payload
  if (lxm !== undefined) {
    throw new EntrywayRelayTokenError('has_lxm')
  }
  // jwtVerify() made "iat" and "exp" required numbers
  if (exp! - iat! > ENTRYWAY_RELAY_TOKEN_MAX_LIFETIME_SEC) {
    throw new EntrywayRelayTokenError('bad_lifetime')
  }
  const ip = typeof clientIp === 'string' ? canonicalIp(clientIp) : null
  if (!ip) {
    throw new EntrywayRelayTokenError('bad_client_ip')
  }
  return ip
}
