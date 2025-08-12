import { z } from 'zod'
import {
  LoopbackUri,
  httpsUriSchema,
  loopbackUriSchema,
  privateUseUriSchema,
} from './uri.js'

export const oauthLoopbackRedirectURISchema = loopbackUriSchema.transform(
  (value: LoopbackUri, ctx) => {
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
        code: 'custom',
        message:
          'Use of "localhost" hostname is not allowed (RFC 8252), use a loopback IP such as "127.0.0.1" instead',
      })
      return z.NEVER
    }

    return value as Exclude<LoopbackUri, `http://localhost${string}`>
  },
)
export type OAuthLoopbackRedirectURI = z.output<
  typeof oauthLoopbackRedirectURISchema
>

export const oauthHttpsRedirectURISchema = httpsUriSchema
export type OAuthHttpsRedirectURI = z.output<typeof oauthHttpsRedirectURISchema>

export const oauthPrivateUseRedirectURISchema = privateUseUriSchema
export type OAuthPrivateUseRedirectURI = z.output<
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

export type OAuthRedirectUri = z.output<typeof oauthRedirectUriSchema>
