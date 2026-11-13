export function obfuscateEmail(email: string) {
  const [local, domain] = email.split('@')
  return `${obfuscateWord(local)}@${obfuscateWord(domain)}`
}

export function obfuscateWord(word: string) {
  return `${word.charAt(0)}***${word.charAt(word.length - 1)}`
}

type HeaderValue = string | string[] | number | undefined

export function obfuscateHeaders(
  headers: Record<string, string>,
): Record<string, string>
export function obfuscateHeaders(
  headers: Record<string, HeaderValue>,
): Record<string, HeaderValue>
export function obfuscateHeaders(headers: Record<string, HeaderValue>) {
  const obfuscatedHeaders: Record<string, HeaderValue> = {}
  for (const key in headers) {
    const name = key.toLowerCase()
    const value = headers[key]
    if (name === 'cookie' || name === 'set-cookie') {
      obfuscatedHeaders[key] = '[Redacted]'
    } else if (name === 'authorization') {
      obfuscatedHeaders[key] =
        typeof value === 'string' ? obfuscateAuthHeader(value) : 'Invalid'
    } else if (name === 'dpop') {
      obfuscatedHeaders[key] =
        typeof value === 'string' ? obfuscateJwt(value) || 'Invalid' : 'Invalid'
    } else {
      obfuscatedHeaders[key] = value
    }
  }
  return obfuscatedHeaders
}

/** Redact headers on the serialized response passed by pino-http. */
export function obfuscateResSerializer(res: {
  statusCode?: number | null
  headers?: Record<string, HeaderValue>
}) {
  return {
    statusCode: res.statusCode ?? null,
    headers: res.headers ? obfuscateHeaders(res.headers) : res.headers,
  }
}

export function obfuscateAuthHeader(authHeader: string): string {
  // This is a hot path (runs on every request). Avoid using split() or regex.

  const spaceIdx = authHeader.indexOf(' ')
  if (spaceIdx === -1) return 'Invalid'

  const type = authHeader.slice(0, spaceIdx)
  switch (type.toLowerCase()) {
    case 'bearer':
    case 'dpop':
      return `${type} ${obfuscateBearer(authHeader.slice(spaceIdx + 1))}`
    case 'basic':
      return `${type} ${obfuscateBasic(authHeader.slice(spaceIdx + 1)) || 'Invalid'}`
    default:
      return `Invalid`
  }
}

export function obfuscateBasic(token: string): null | string {
  if (!token) return null
  const buffer = Buffer.from(token, 'base64')
  if (!buffer.length) return null // Buffer.from will silently ignore invalid base64 chars
  const authHeader = buffer.toString('utf8')
  const colIdx = authHeader.indexOf(':')
  if (colIdx === -1) return null
  const username = authHeader.slice(0, colIdx)
  return `${username}:***`
}

export function obfuscateBearer(token: string): string {
  return obfuscateJwt(token) || obfuscateToken(token)
}

export function obfuscateToken(token: string): string {
  if (token.length >= 12) return obfuscateWord(token)
  return token ? '***' : ''
}

export function obfuscateJwt(token: string): null | string {
  const firstDot = token.indexOf('.')
  if (firstDot === -1) return null

  const secondDot = token.indexOf('.', firstDot + 1)
  if (secondDot === -1) return null

  // Expected to be missing
  const thirdDot = token.indexOf('.', secondDot + 1)
  if (thirdDot !== -1) return null

  try {
    const payloadEnc = token.slice(firstDot + 1, secondDot)
    const payloadJson = Buffer.from(payloadEnc, 'base64').toString('utf8')
    const payload = JSON.parse(payloadJson)
    if (typeof payload.sub === 'string') return payload.sub
  } catch {
    // Invalid JWT
    return null
  }

  // Strip the signature
  return token.slice(0, secondDot) + '.obfuscated'
}
