import pinoHttp from 'pino-http'
import { subsystemLogger } from '@atproto/common'

export const logger = subsystemLogger('plc')

export const loggerMiddleware = pinoHttp({
  logger,
})
