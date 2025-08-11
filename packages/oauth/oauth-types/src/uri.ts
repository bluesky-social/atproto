import { z } from 'zod'
import { isHostnameIP, isLoopbackHost } from './util.js'

const canParseUrl =
  // eslint-disable-next-line n/no-unsupported-features/node-builtins
  URL.canParse ??
  // URL.canParse is not available in Node.js < 18.7.0
  ((urlStr: string): boolean => {
    try {
      new URL(urlStr)
      return true
    } catch {
      return false
    }
  })

/**
 * Valid, but potentially dangerous URL (`data:`, `file:`, `javascript:`, etc.).
 */
export type DangerousUri = `${string}:${string}`

const isDangerousUri = (input: unknown): input is DangerousUri => {
  return typeof input === 'string' && input.includes(':') && canParseUrl(input)
}

/**
 * Valid, but potentially dangerous URL (`data:`, `file:`, `javascript:`, etc.).
 *
 * Any value that matches this schema is safe to parse using `new URL()`.
 */
export const dangerousUriSchema = z.custom<DangerousUri>(isDangerousUri, {
  error: 'Invalid URL',
})

export const loopbackUriSchema = dangerousUriSchema.transform((input, ctx) => {
  // Loopback url must use the "http:" protocol
  if (!input.startsWith('http://')) {
    ctx.addIssue({
      code: 'custom',
      message: 'URL must use the "http:" protocol',
    })
    return z.NEVER
  }

  const url = new URL(input)

  if (!isLoopbackHost(url.hostname)) {
    ctx.addIssue({
      code: 'custom',
      message: 'URL must use "localhost", "127.0.0.1" or "[::1]" as hostname',
    })
    return z.NEVER
  }

  return input as
    | `http://[::1]${string}`
    | `http://localhost${'' | `${':' | '/' | '?' | '#'}${string}`}`
    | `http://127.0.0.1${'' | `${':' | '/' | '?' | '#'}${string}`}`
})

export type LoopbackUri = z.output<typeof loopbackUriSchema>

export const httpsUriSchema = dangerousUriSchema.transform((input, ctx) => {
  if (!input.startsWith('https://')) {
    ctx.addIssue({
      code: 'custom',
      message: 'URL must use the "https:" protocol',
    })
    return z.NEVER
  }

  const url = new URL(input)

  // Disallow loopback URLs with the `https:` protocol
  if (isLoopbackHost(url.hostname)) {
    ctx.addIssue({
      code: 'custom',
      message: 'https: URL must not use a loopback host',
    })
    return z.NEVER
  }

  if (isHostnameIP(url.hostname)) {
    // Hostname is an IP address
  } else {
    // Hostname is a domain name
    if (!url.hostname.includes('.')) {
      // we don't depend on PSL here, so we only check for a dot
      ctx.addIssue({
        code: 'custom',
        message: 'Domain name must contain at least two segments',
      })
      return z.NEVER
    }

    if (url.hostname.endsWith('.local')) {
      ctx.addIssue({
        code: 'custom',
        message: 'Domain name must not end with ".local"',
      })
      return z.NEVER
    }
  }

  return input as `https://${string}`
})

export type HttpsUri = z.output<typeof httpsUriSchema>

export const webUriSchema = z.union([loopbackUriSchema, httpsUriSchema], {
  error: 'URL must use the "http:" or "https:" protocol',
})

export type WebUri = z.output<typeof webUriSchema>

export type PrivateUseUri = `${string}.${string}:/${string}`
export const privateUseUriSchema = z.custom<PrivateUseUri>(
  (input) => {
    if (typeof input !== 'string') {
      return false
    }

    // Optimization: avoid parsing the URL if the protocol does not contain a "."
    const dotIdx = input.indexOf('.')
    const colonIdx = input.indexOf(':')
    if (dotIdx === -1 || colonIdx === -1 || dotIdx > colonIdx) {
      return false
    }

    try {
      const url = new URL(input)

      // Should be covered by the check before, but let's be extra sure
      if (!url.protocol.includes('.')) {
        return false
      }

      if (url.hostname) {
        // https://datatracker.ietf.org/doc/html/rfc8252#section-7.1
        return false
      }

      return true
    } catch {
      return false
    }
  },
  {
    error: 'Invalid private-use URI scheme (RFC 8252)',
  },
)
