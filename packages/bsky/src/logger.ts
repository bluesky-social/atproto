import pinoHttp from 'pino-http'
import { subsystemLogger } from '@atproto/common'

export const dbLogger = subsystemLogger('bsky:db')
export const subLogger = subsystemLogger('bsky:sub')
export const labelerLogger = subsystemLogger('bsky:labeler')
export const httpLogger = subsystemLogger('bsky')

export const loggerMiddleware = pinoHttp({
  logger: httpLogger,
})
