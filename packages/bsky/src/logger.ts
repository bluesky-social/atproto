import type { IncomingMessage, ServerResponse } from 'node:http'
import { stdSerializers } from 'pino'
import { pinoHttp } from 'pino-http'
import {
  obfuscateHeaders,
  obfuscateResSerializer,
  subsystemLogger,
} from '@atproto/common'

export const dbLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('bsky:db')
export const cacheLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('bsky:cache')
export const subLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('bsky:sub')
export const labelerLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('bsky:labeler')
export const hydrationLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('bsky:hydration')
export const featureGatesLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('bsky:featuregates')
export const dataplaneLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('bsky:dp')
export const ageAssuranceLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('bsky:aa')
export const viewsLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('bsky:views')
export const httpLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('bsky')
export const eventsLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('bsky:events')

const blobUpstreamMs = Symbol('blobUpstreamMs')
type ResponseWithBlobUpstreamMs = ServerResponse & {
  [blobUpstreamMs]?: number
}

export function recordBlobUpstreamDuration(
  res: ServerResponse,
  durationMs: number,
): void {
  const response = res as ResponseWithBlobUpstreamMs
  response[blobUpstreamMs] = durationMs
}

export const loggerMiddleware = pinoHttp({
  logger: httpLogger,
  customProps: (_req, res) => {
    const upstreamMs = (res as ResponseWithBlobUpstreamMs)[blobUpstreamMs]
    return upstreamMs === undefined ? {} : { upstream_ms: upstreamMs }
  },
  serializers: {
    res: obfuscateResSerializer,
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
