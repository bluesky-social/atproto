import { type IncomingMessage } from 'node:http'
import { pinoHttp, stdSerializers } from 'pino-http'
import { obfuscateHeaders, subsystemLogger } from '@atproto/common'

export const dbLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('bsync:db')
export const httpLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('bsync')

export const loggerMiddleware = pinoHttp({
  logger: httpLogger,
  redact: {
    paths: ['req.headers.authorization'],
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
