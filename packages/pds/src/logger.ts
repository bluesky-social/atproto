import type { IncomingMessage } from 'node:http'
import { stdSerializers } from 'pino'
import { pinoHttp } from 'pino-http'
import { createLogger, obfuscateHeaders } from '@atproto/common'

export const pdsLogger = createLogger('pds')
export const blobStoreLogger = createLogger('pds:blob-store')
export const dbLogger = createLogger('pds:db')
export const didCacheLogger = createLogger('pds:did-cache')
export const eventsLogger = createLogger('pds:events')
export const readStickyLogger = createLogger('pds:read-sticky')
export const redisLogger = createLogger('pds:redis')
export const seqLogger = createLogger('pds:sequencer')
export const mailerLogger = createLogger('pds:mailer')
export const labelerLogger = createLogger('pds:labeler')
export const crawlerLogger = createLogger('pds:crawler')
// @TODO Use a distinct namespace for the "http" subsystem. Also, review uses of
// the httpLogger.
export const httpLogger = pdsLogger
export const fetchLogger = createLogger('pds:fetch')
export const accountLogger = createLogger('pds:account', {
  serializers: {
    account: accountSerializer,
  },
})
export const oauthLogger = createLogger('pds:oauth', {
  serializers: {
    account: accountSerializer,
    req: reqSerializer,
  },
})
export const sessionLogger = createLogger('pds:session', {
  serializers: {
    account: accountSerializer,
    req: reqSerializer,
  },
})
export const lexiconResolverLogger = createLogger('pds:lexicon-resolver')

export const loggerMiddleware = pinoHttp({
  logger: httpLogger,
  serializers: {
    req: reqSerializer,
    err: (err: unknown) => ({
      code: err?.['code'],
      message: err?.['message'],
    }),
  },
})

function accountSerializer(account: { did: string }) {
  return { did: account.did }
}

function reqSerializer(req: IncomingMessage) {
  const serialized = stdSerializers.req(req)
  const headers = obfuscateHeaders(serialized.headers)
  return { ...serialized, headers }
}
