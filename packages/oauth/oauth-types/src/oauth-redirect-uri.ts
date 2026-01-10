import { TypeOf, ZodIssueCode, z } from 'zod'
import {
  HttpsUri,
  LoopbackUri,
  PrivateUseUri,
  httpsUriSchema,
  loopbackUriSchema,
  privateUseUriSchema,
} from './uri.js'

/**
 * This is a {@link loopbackUriSchema} with the additional restriction that
 * the hostname `localhost` is not allowed.
 *
 * @see {@link https://datatracker.ietf.org/doc/html/rfc8252#section-8.3 Loopback Redirect Considerations} RFC8252
 *
 * > While redirect URIs using localhost (i.e.,
 * > "http://localhost:{port}/{path}") function similarly to loopback IP
 * > redirects described in Section 7.3, the use of localhost is NOT
 * > RECOMMENDED. Specifying a redirect URI with the loopback IP literal rather
 * > than localhost avoids inadvertently listening on network interfaces other
 * > than the loopback interface.  It is also less susceptible to client-side
 * > firewalls and misconfigured host name resolution on the user's device.
 */
export const loopbackRedirectURISchema = loopbackUriSchema.superRefine(
  (value, ctx): value is Exclude<LoopbackUri, `http://localhost${string}`> => {
    if (value.startsWith('http://localhost')) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message:
          'Use of "localhost" hostname is not allowed (RFC 8252), use a loopback IP such as "127.0.0.1" instead',
      })
      return false
    }

    return true
  },
)
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
