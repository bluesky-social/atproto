import type { IncomingMessage } from 'node:http'
import { stdSerializers } from 'pino'
import { type HttpLogger, pinoHttp, startTime } from 'pino-http'
import { obfuscateHeaders, subsystemLogger } from '@atproto/common'
import type { ServerConfig } from './config.js'

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
export const ageAssuranceLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('bsky:aa')
export const viewsLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('bsky:views')
export const httpLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('bsky')
export const eventsLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('bsky:events')

export function createLoggerMiddleware(
  config: Pick<
    ServerConfig,
    'httpLogSuccessSampleRate' | 'httpLogSlowRequestMs'
  >,
): HttpLogger {
  return pinoHttp({
    logger: httpLogger,
    customLogLevel: (req, res, err) => {
      if (
        config.httpLogSuccessSampleRate === 1 ||
        err ||
        res.err ||
        res.destroyed ||
        res.statusCode >= 400 ||
        req.readableAborted ||
        !res.writableEnded ||
        Date.now() - res[startTime] >= config.httpLogSlowRequestMs ||
        Math.random() < config.httpLogSuccessSampleRate
      ) {
        return 'info'
      }
      return 'silent'
    },
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
}
