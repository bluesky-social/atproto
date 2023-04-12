import pino from 'pino'
import pinoHttp from 'pino-http'
import { subsystemLogger } from '@atproto/common'
import * as jwt from 'jsonwebtoken'
import { parseBasicAuth } from './auth'

export const dbLogger = subsystemLogger('pds:db')
export const seqLogger = subsystemLogger('pds:sequencer')
export const mailerLogger = subsystemLogger('pds:mailer')
export const labelerLogger = subsystemLogger('pds:labler')
export const httpLogger = subsystemLogger('pds')

export const loggerMiddleware = pinoHttp({
  logger: httpLogger,
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
