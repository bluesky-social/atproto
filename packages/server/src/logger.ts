import pino from 'pino'
import pinoHttp from 'pino-http'
import { subsystemLogger } from '@adxp/common'

export const logger = subsystemLogger('pds')

export const loggerMiddleware = pinoHttp({
  logger,
  serializers: {
    req: (req) => {
      const serialized = pino.stdSerializers.req(req)
      const authHeader = serialized.headers.authorization || ''
      let auth = 'NONE'
      if (authHeader.startsWith('Bearer ')) auth = 'BEARER'
      if (authHeader.startsWith('Basic ')) auth = 'BASIC'
      return {
        ...serialized,
        headers: {
          ...serialized.headers,
          authorization: auth,
        },
      }
    },
  },
})
