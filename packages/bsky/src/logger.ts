import { stdSerializers } from 'pino'
import pinoHttp from 'pino-http'
import { subsystemLogger } from '@atproto/common'

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
export const httpLogger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('bsky')

export const loggerMiddleware = pinoHttp({
  logger: httpLogger,
  serializers: {
    err: errSerializer,
    req: reqSerializer,
  },
})

function errSerializer(err: any) {
  return {
    code: err?.code,
    message: err?.message,
  }
}

function reqSerializer(req: any) {
  const serialized = stdSerializers.req(req)
  serialized.headers = obfuscateHeaders(serialized.headers)
  return serialized
}

function obfuscateHeaders(headers: Record<string, string>) {
  const obfuscatedHeaders: Record<string, string> = {}
  for (const key in headers) {
    if (key.toLowerCase() === 'authorization') {
      obfuscatedHeaders[key] = obfuscateAuthHeader(headers[key])
    } else if (key.toLowerCase() === 'dpop') {
      obfuscatedHeaders[key] = obfuscateJws(headers[key]) || 'Invalid'
    } else {
      obfuscatedHeaders[key] = headers[key]
    }
  }
  return obfuscatedHeaders
}

function obfuscateAuthHeader(authHeader: string): string {
  // This is a hot path (runs on every request). Avoid using split() or regex.

  const spaceIdx = authHeader.indexOf(' ')
  if (spaceIdx === -1) return 'Invalid'

  const type = authHeader.slice(0, spaceIdx)
  switch (type.toLowerCase()) {
    case 'bearer':
      return `${type} ${obfuscateBearer(authHeader.slice(spaceIdx + 1))}`
    case 'dpop':
      return `${type} ${obfuscateJws(authHeader.slice(spaceIdx + 1)) || 'Invalid'}`
    case 'basic':
      return `${type} ${obfuscateBasic(authHeader.slice(spaceIdx + 1)) || 'Invalid'}`
    default:
      return `Invalid`
  }
}

function obfuscateBasic(token: string): null | string {
  if (!token) return null
  const buffer = Buffer.from(token, 'base64')
  if (!buffer.length) return null // Buffer.from will silently ignore invalid base64 chars
  const authHeader = buffer.toString('utf8')
  const colIdx = authHeader.indexOf(':')
  if (colIdx === -1) return null
  const username = authHeader.slice(0, colIdx)
  return `${username}:***`
}

function obfuscateBearer(token: string): string {
  return obfuscateJws(token) || obfuscateToken(token)
}

function obfuscateToken(token: string): string {
  return token ? '***' : ''
}

function obfuscateJws(token: string): null | string {
  const firstDot = token.indexOf('.')
  if (firstDot === -1) return null

  const secondDot = token.indexOf('.', firstDot + 1)
  if (secondDot === -1) return null

  if (token.indexOf('.', secondDot + 1) !== -1) return null

  // Strip the signature
  return token.slice(0, secondDot) + '.obfuscated'
}
