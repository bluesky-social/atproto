import { TypeOf, z } from 'zod'
import {
  httpsUriSchema,
  loopbackUriSchema,
  privateUseUriSchema,
} from './uri.js'

export const oauthLoopbackRedirectURISchema = loopbackUriSchema
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
