import { TypeOf, ZodIssueCode, z } from 'zod'
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
 *
 * Any value that matches this schema is safe to parse using `new URL()`.
 */
export const dangerousUriSchema = z
  .string()
  .refine(
    (data): data is `${string}:${string}` =>
      data.includes(':') && canParseUrl(data),
    {
      message: 'Invalid URL',
    },
  )

/**
 * Valid, but potentially dangerous URL (`data:`, `file:`, `javascript:`, etc.).
 */
export type DangerousUrl = TypeOf<typeof dangerousUriSchema>

export const loopbackUriSchema = dangerousUriSchema.superRefine(
  (
    value,
    ctx,
  ): value is
    | `http://[::1]${string}`
    | `http://localhost${'' | `${':' | '/' | '?' | '#'}${string}`}`
    | `http://127.0.0.1${'' | `${':' | '/' | '?' | '#'}${string}`}` => {
    // Loopback url must use the "http:" protocol
    if (!value.startsWith('http://')) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: 'URL must use the "http:" protocol',
      })
      return false
    }

    const url = new URL(value)

    if (!isLoopbackHost(url.hostname)) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: 'URL must use "localhost", "127.0.0.1" or "[::1]" as hostname',
      })
      return false
    }

    return true
  },
)

export type LoopbackUri = TypeOf<typeof loopbackUriSchema>

export const httpsUriSchema = dangerousUriSchema.superRefine(
  (value, ctx): value is `https://${string}` => {
    if (!value.startsWith('https://')) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: 'URL must use the "https:" protocol',
      })
      return false
    }

    const url = new URL(value)

    // Disallow loopback URLs with the `https:` protocol
    if (isLoopbackHost(url.hostname)) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: 'https: URL must not use a loopback host',
      })
      return false
    }

    if (isHostnameIP(url.hostname)) {
      // Hostname is an IP address
    } else {
      // Hostname is a domain name
      if (!url.hostname.includes('.')) {
        // we don't depend on PSL here, so we only check for a dot
        ctx.addIssue({
          code: ZodIssueCode.custom,
          message: 'Domain name must contain at least two segments',
        })
        return false
      }

      if (url.hostname.endsWith('.local')) {
        ctx.addIssue({
          code: ZodIssueCode.custom,
          message: 'Domain name must not end with ".local"',
        })
        return false
      }
    }

    return true
  },
)

export type HttpsUri = TypeOf<typeof httpsUriSchema>

export const webUriSchema = z
  .string()
  .superRefine((value, ctx): value is LoopbackUri | HttpsUri => {
    // discriminated union of `loopbackUriSchema` and `httpsUriSchema`
    if (value.startsWith('http://')) {
      const result = loopbackUriSchema.safeParse(value)
      if (!result.success) result.error.issues.forEach(ctx.addIssue, ctx)
      return result.success
    }

    if (value.startsWith('https://')) {
      const result = httpsUriSchema.safeParse(value)
      if (!result.success) result.error.issues.forEach(ctx.addIssue, ctx)
      return result.success
    }

    ctx.addIssue({
      code: ZodIssueCode.custom,
      message: 'URL must use the "http:" or "https:" protocol',
    })
    return false
  })

export type WebUri = TypeOf<typeof webUriSchema>

export const privateUseUriSchema = dangerousUriSchema.superRefine(
  (value, ctx): value is `${string}.${string}:/${string}` => {
    const dotIdx = value.indexOf('.')
    const colonIdx = value.indexOf(':')

    // Optimization: avoid parsing the URL if the protocol does not contain a "."
    if (dotIdx === -1 || colonIdx === -1 || dotIdx > colonIdx) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message:
          'Private-use URI scheme requires a "." as part of the protocol',
      })
      return false
    }

    const url = new URL(value)

    // Should be covered by the check before, but let's be extra sure
    if (!url.protocol.includes('.')) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: 'Invalid private-use URI scheme',
      })
      return false
    }

    if (url.hostname) {
      // https://datatracker.ietf.org/doc/html/rfc8252#section-7.1
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message:
          'Private-use URI schemes must not include a hostname (only one "/" is allowed after the protocol, as per RFC 8252)',
      })
      return false
    }

    return true
  },
)

export type PrivateUseUri = TypeOf<typeof privateUseUriSchema>
