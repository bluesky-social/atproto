import * as pino from 'pino'
import * as pinoHttp from 'pino-http'
import * as jwt from 'jsonwebtoken'
import { parseBasicAuth } from './auth'
import * as xrpc from '@atproto/xrpc-server'

export type Logger = xrpc.Logger & {
  http: pino.Logger
  db: pino.Logger
  seq: pino.Logger
  redis: pino.Logger
  mailer: pino.Logger
  labeler: pino.Logger
  crawler: pino.Logger
  munge: pino.Logger
}

export const createLogger = (
  opts: Partial<xrpc.LoggerOpts> = {},
): { logger: Logger; logMiddleware: pinoHttp.HttpLogger } => {
  const logger = xrpc.createLogger(opts)
  const http = logger.child({ name: 'pds' })
  logger['http'] = http
  logger['db'] = logger.child({ name: 'pds:db' })
  logger['seq'] = logger.child({ name: 'pds:sequencer' })
  logger['redis'] = logger.child({ name: 'pds:redis' })
  logger['mailer'] = logger.child({ name: 'pds:mailer' })
  logger['labeler'] = logger.child({ name: 'pds:labeler' })
  logger['crawler'] = logger.child({ name: 'pds:crawler' })
  logger['munge'] = logger.child({ name: 'pds:munge' })
  const logMiddleware = createLoggerMiddleware(http)
  return { logger: logger as Logger, logMiddleware }
}

export const createLoggerMiddleware = (logger: pino.Logger) => {
  return pinoHttp.default({
    logger,
    serializers: {
      req: (req) => {
        const serialized = pino.stdSerializers.req(req)
        const authHeader = serialized.headers.authorization || ''
        let auth: string | undefined = undefined
        if (authHeader.startsWith('Bearer ')) {
          const token = authHeader.slice('Bearer '.length)
          const sub = jwt.decode(token)?.sub
          if (sub) {
            auth = 'Bearer ' + sub
          } else {
            auth = 'Bearer Invalid'
          }
        }
        if (authHeader.startsWith('Basic ')) {
          const parsed = parseBasicAuth(authHeader)
          if (!parsed) {
            auth = 'Basic Invalid'
          } else {
            auth = 'Basic ' + parsed.username
          }
        }
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
}
