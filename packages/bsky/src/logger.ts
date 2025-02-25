import { IncomingMessage } from 'node:http'
import { stdSerializers } from 'pino'
import { pinoHttp } from 'pino-http'
import { obfuscateHeaders, subsystemLogger } from '@atproto/common'

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
export const featureGatesLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('bsky:featuregates')
export const dataplaneLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('bsky:dp')
export const httpLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('bsky')

export const loggerMiddleware = pinoHttp({
  logger: httpLogger,
  serializers: {
    err: (err: unknown) => ({
      code: err?.['code'],
      message: err?.['message'],
    }),
    req: (req: IncomingMessage) => {
      const serialized = stdSerializers.req(req)
      const headers = obfuscateHeaders(serialized.headers)
      return { ...serialized, headers }
    },
  },
})
