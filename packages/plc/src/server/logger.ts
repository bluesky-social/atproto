import pinoHttp from 'pino-http'
import { subsystemLogger } from '@adxp/common'

export const logger = subsystemLogger('plc')

export const loggerMiddleware = pinoHttp({
  logger,
})
