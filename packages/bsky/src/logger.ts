import pinoHttp from 'pino-http'
import { subsystemLogger } from '@atproto/common'

export const dbLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('bsky:db')
export const subLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('bsky:sub')
export const labelerLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('bsky:labeler')
export const httpLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('bsky')

export const loggerMiddleware = pinoHttp({
  logger: httpLogger,
})
