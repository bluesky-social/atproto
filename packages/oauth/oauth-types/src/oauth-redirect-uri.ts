import { type TypeOf, ZodIssueCode, z } from 'zod'
import {
  type HttpsUri,
  type PrivateUseUri,
  httpsUriSchema,
  loopbackUriSchema,
  privateUseUriSchema,
} from './uri.js'

/**
 * Any loopback URI ("localhost", "127.0.0.1" or "[::1]" hostname) is allowed
 * as a redirect URI.
 *
 * @NOTE {@link https://datatracker.ietf.org/doc/html/rfc8252#section-8.3 RFC8252}
 * recommends loopback IP literals over "localhost" for native apps binding a
 * local port listener, out of concern that "localhost" could resolve to a
 * non-loopback address. The atproto OAuth profile allows "localhost" redirect
 * URIs for loopback (development) clients: browser-mediated flows resolve
 * "localhost" to the loopback interface, and the mandatory PKCE and DPoP
 * requirements prevent use of an intercepted authorization code.
 *
 * @see {@link https://atproto.com/specs/oauth#localhost-client-development}
 */
export const loopbackRedirectURISchema = loopbackUriSchema
export type LoopbackRedirectURI = TypeOf<typeof loopbackRedirectURISchema>

export const oauthLoopbackClientRedirectUriSchema = loopbackRedirectURISchema
export type OAuthLoopbackRedirectURI = TypeOf<
  typeof oauthLoopbackClientRedirectUriSchema
>

export const oauthRedirectUriSchema = z
  .string()
  .superRefine(
    (value, ctx): value is HttpsUri | LoopbackRedirectURI | PrivateUseUri => {
      if (value.startsWith('https:')) {
        const result = httpsUriSchema.safeParse(value)
        if (!result.success) result.error.issues.forEach(ctx.addIssue, ctx)
        return result.success
      } else if (value.startsWith('http:')) {
        const result = loopbackRedirectURISchema.safeParse(value)
        if (!result.success) result.error.issues.forEach(ctx.addIssue, ctx)
        return result.success
      } else if (/^[^.:]+(?:\.[^.:]+)+:/.test(value)) {
        const result = privateUseUriSchema.safeParse(value)
        if (!result.success) result.error.issues.forEach(ctx.addIssue, ctx)
        return result.success
      } else {
        ctx.addIssue({
          code: ZodIssueCode.custom,
          message:
            'URL must use the "https:" or "http:" protocol, or a private-use URI scheme (RFC 8252)',
        })
        return false
      }
    },
  )

export type OAuthRedirectUri = TypeOf<typeof oauthRedirectUriSchema>
