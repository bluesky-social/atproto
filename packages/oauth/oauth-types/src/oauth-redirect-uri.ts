import { TypeOf, ZodIssueCode, z } from 'zod'
import {
  LoopbackUri,
  httpsUriSchema,
  loopbackUriSchema,
  privateUseUriSchema,
} from './uri.js'

export const oauthLoopbackRedirectURISchema = loopbackUriSchema.superRefine(
  (value, ctx): value is Exclude<LoopbackUri, `http://localhost${string}`> => {
    if (value.startsWith('http://localhost')) {
      // https://datatracker.ietf.org/doc/html/rfc8252#section-8.3
      //
      // > While redirect URIs using localhost (i.e.,
      // > "http://localhost:{port}/{path}") function similarly to loopback IP
      // > redirects described in Section 7.3, the use of localhost is NOT
      // > RECOMMENDED.  Specifying a redirect URI with the loopback IP literal
      // > rather than localhost avoids inadvertently listening on network
      // > interfaces other than the loopback interface.  It is also less
      // > susceptible to client-side firewalls and misconfigured host name
      // > resolution on the user's device.
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
export type OAuthLoopbackRedirectURI = TypeOf<
  typeof oauthLoopbackRedirectURISchema
>

export const oauthHttpsRedirectURISchema = httpsUriSchema
export type OAuthHttpsRedirectURI = TypeOf<typeof oauthHttpsRedirectURISchema>

export const oauthPrivateUseRedirectURISchema = privateUseUriSchema
export type OAuthPrivateUseRedirectURI = TypeOf<
  typeof oauthPrivateUseRedirectURISchema
>

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
