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
export const hydrationLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('bsky:hydration')
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
      const authHeader = serialized.headers.authorization || ''
      let auth: string | undefined = undefined
      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice('Bearer '.length)
        const { iss } = jose.decodeJwt(token)
        if (iss) {
          auth = 'Bearer ' + iss
        } else {
          auth = 'Bearer Invalid'
        }
      }
      if (authHeader.startsWith('Basic ')) {
        const parsed = parseBasicAuth(authHeader)
        if (!parsed) {
          auth = 'Basic Invalid'
        } else {
          auth = 'Basic ' + parsed.username
        }
      }
      return {
        ...serialized,
        headers: {
          ...serialized.headers,
          authorization: auth,
        },
      }
    },
  },
})
