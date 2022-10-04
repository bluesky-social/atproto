import pinoHttp from 'pino-http'
import { createLogger } from '@adxp/common'

export const logger = createLogger('pds')
// @TODO config to strip out auth tokens
export const loggerMiddleware = pinoHttp({
  logger,
})
