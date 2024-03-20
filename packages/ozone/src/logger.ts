import pinoHttp from 'pino-http'
import { subsystemLogger } from '@atproto/common'

export const dbLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('ozone:db')
export const seqLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('ozone:sequencer')
export const httpLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('ozone')
export const langLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('ozone:lang')

export const loggerMiddleware = pinoHttp({
  logger: httpLogger,
  serializers: {
    err: (err) => {
      return {
        code: err?.code,
        message: err?.message,
      }
    },
  },
})
