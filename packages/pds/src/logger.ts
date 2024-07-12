import { stdSerializers } from 'pino'
import pinoHttp from 'pino-http'
import { obfuscateHeaders, subsystemLogger } from '@atproto/common'

export const dbLogger = subsystemLogger('pds:db')
export const didCacheLogger = subsystemLogger('pds:did-cache')
export const readStickyLogger = subsystemLogger('pds:read-sticky')
export const redisLogger = subsystemLogger('pds:redis')
export const seqLogger = subsystemLogger('pds:sequencer')
export const mailerLogger = subsystemLogger('pds:mailer')
export const labelerLogger = subsystemLogger('pds:labeler')
export const crawlerLogger = subsystemLogger('pds:crawler')
export const httpLogger = subsystemLogger('pds')
export const fetchLogger = subsystemLogger('pds:fetch')
export const oauthLogger = subsystemLogger('pds:oauth')

export const loggerMiddleware = pinoHttp({
  logger: httpLogger,
  serializers: {
    err: errSerializer,
    req: reqSerializer,
  },
})

function errSerializer(err: any) {
  return {
    code: err?.code,
    message: err?.message,
  }
}

function reqSerializer(req: any) {
  const serialized = stdSerializers.req(req)
  serialized.headers = obfuscateHeaders(serialized.headers)
  return serialized
}
