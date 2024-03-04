import pino from 'pino'
import pinoHttp from 'pino-http'
import { subsystemLogger } from '@atproto/common'
import * as jose from 'jose'
import { parseBasicAuth } from './auth-verifier'

export const dbLogger = subsystemLogger('pds:db')
export const didCacheLogger = subsystemLogger('pds:did-cache')
export const readStickyLogger = subsystemLogger('pds:read-sticky')
export const redisLogger = subsystemLogger('pds:redis')
export const seqLogger = subsystemLogger('pds:sequencer')
export const mailerLogger = subsystemLogger('pds:mailer')
export const labelerLogger = subsystemLogger('pds:labeler')
export const crawlerLogger = subsystemLogger('pds:crawler')
export const httpLogger = subsystemLogger('pds')

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
