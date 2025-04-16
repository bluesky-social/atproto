import { type IncomingMessage } from 'node:http'
import { pinoHttp, stdSerializers } from 'pino-http'
import { obfuscateHeaders, subsystemLogger } from '@atproto/common'

export const dbLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('ozone:db')
export const seqLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('ozone:sequencer')
export const httpLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('ozone')
export const langLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('ozone:lang')
export const verificationLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('ozone:verification')

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
