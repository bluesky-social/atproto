import pino from 'pino'
import pinoHttp from 'pino-http'
import * as jose from 'jose'
import { subsystemLogger } from '@atproto/common'
import { parseBasicAuth } from './auth-verifier'

export const dbLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('bsky:db')
export const cacheLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('bsky:cache')
export const subLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('bsky:sub')
export const labelerLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('bsky:labeler')
export const httpLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('bsky')

export const loggerMiddleware = pinoHttp({
  logger: httpLogger,
  serializers: {
    err: (err) => {
      return {
        code: err?.code,
        message: err?.message,
      }
    },
    req: (req) => {
      const serialized = pino.stdSerializers.req(req)
      const authHeader = serialized.headers.authorization

      if (authHeader == null) return serialized

      return {
        ...serialized,
        headers: {
          ...serialized.headers,
          authorization: obfuscateAuthHeader(authHeader),
        },
      }
    },
  },
})

function obfuscateAuthHeader(authHeader: string): string {
  const [type, token] = authHeader.split(' ', 2)
  switch (type) {
    case 'Basic':
      return `${type} ${obfuscateBasic(authHeader!)}`
    case 'Bearer':
    case 'DPoP':
      return `${type} ${obfuscateBearer(token)}`
    default:
      return `Invalid`
  }
}

function obfuscateBasic(authHeader: string): string {
  const parsed = parseBasicAuth(authHeader)
  if (parsed) return parsed.username
  return 'Invalid'
}

function obfuscateBearer(token?: string): string {
  if (token) {
    if (token.includes('.')) {
      try {
        const { sub } = jose.decodeJwt(token)
        if (sub) return sub
      } catch {
        // Not a JWT
      }
    }

    if (token.length > 10) {
      // Log no more than half the token, up to 10 characters. tokens should be
      // long enough to be secure even when half of them are exposed.
      return `${token.slice(0, Math.min(10, token.length / 2))}...`
    }
  }

  return 'Invalid'
}
