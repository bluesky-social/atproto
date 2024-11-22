import { TypeOf, z, ZodIssueCode } from 'zod'
import { dangerousUrlSchema } from './common.js'
import { isLoopbackHost } from './util.js'

export type OAuthLoopbackRedirectURI =
  `http://${'127.0.0.1' | '[::1]'}${'' | `${':' | '/' | '?' | '#'}${string}`}`
export const oauthLoopbackRedirectURISchema = dangerousUrlSchema.superRefine(
  (value, ctx): value is OAuthLoopbackRedirectURI => {
    if (!value.startsWith('http://')) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: 'URL must use the "http:" protocol',
      })
      return false
    }

    const url = new URL(value)

    if (url.hostname === 'localhost') {
      // https://datatracker.ietf.org/doc/html/rfc8252#section-8.3
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message:
          'Use of "localhost" for redirect uris is not allowed (RFC 8252)',
      })
      return false
    }

    if (!isLoopbackHost(url.hostname)) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message:
          'HTTP redirect uris must use "127.0.0.1" or "[::1]" as the hostname',
      })
      return false
    }

    return true
  },
)

export type OAuthHttpsRedirectURI = `https://${string}`
export const oauthHttpsRedirectURISchema = dangerousUrlSchema.superRefine(
  (value, ctx): value is OAuthHttpsRedirectURI => {
    if (!value.startsWith('https://')) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: 'URL must use the "https:" protocol',
      })
      return false
    }

    return true
  },
)

export type OAuthPrivateUseRedirectURI = `${string}.${string}:/${string}`
export const oauthPrivateUseRedirectURISchema = dangerousUrlSchema.superRefine(
  (value, ctx): value is OAuthPrivateUseRedirectURI => {
    const url = new URL(value)

    if (url.protocol.includes('.')) {
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
    }

    ctx.addIssue({
      code: ZodIssueCode.custom,
      message: 'URL must use a private-use URI scheme',
    })
    return false
  },
)

export const oauthRedirectUriSchema = z.union(
  [
    oauthLoopbackRedirectURISchema,
    oauthHttpsRedirectURISchema,
    oauthPrivateUseRedirectURISchema,
  ],
  {
    message: `URL must use the "https:" or "http:" protocol, or a private-use URI scheme (RFC 8252)`,
  },
)

export type OAuthRedirectUri = TypeOf<typeof oauthRedirectUriSchema>
