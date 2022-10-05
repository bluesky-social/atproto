import pinoHttp from 'pino-http'
import { subsystemLogger } from '@adxp/common'

export const logger = subsystemLogger('pds')
// @TODO config to strip out auth tokens
export const loggerMiddleware = pinoHttp({
  logger,
})
