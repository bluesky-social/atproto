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
      const authHeader = serialized.headers.authorization || ''
      let auth: string | undefined = undefined
      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice('Bearer '.length)
        const { sub } = jose.decodeJwt(token)
        if (sub) {
          auth = 'Bearer ' + sub
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
