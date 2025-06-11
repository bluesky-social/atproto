import { z } from 'zod'
import { signedJwtSchema } from '@atproto/jwk'
import { CLIENT_ASSERTION_TYPE_JWT_BEARER } from './constants.js'
import { oauthClientIdSchema } from './oauth-client-id.js'

export const oauthClientCredentialsJwtBearerSchema = z.object({
  client_id: oauthClientIdSchema,
  client_assertion_type: z.literal(CLIENT_ASSERTION_TYPE_JWT_BEARER),
  /**
   * - "sub" the subject MUST be the "client_id" of the OAuth client
   * - "iat" is required and MUST be less than one minute
   * - "aud" must containing a value that identifies the authorization server
   * - The JWT MAY contain a "jti" (JWT ID) claim that provides a unique identifier for the token.
   * - Note that the authorization server may reject JWTs with an "exp" claim value that is unreasonably far in the future.
   *
   * @see {@link https://datatracker.ietf.org/doc/html/rfc7523#section-3}
   */
  client_assertion: signedJwtSchema,
})

export type OAuthClientCredentialsJwtBearer = z.infer<
  typeof oauthClientCredentialsJwtBearerSchema
>

export const oauthClientCredentialsSecretPostSchema = z.object({
  client_id: oauthClientIdSchema,
  client_secret: z.string(),
})

export type OAuthClientCredentialsSecretPost = z.infer<
  typeof oauthClientCredentialsSecretPostSchema
>

export const oauthClientCredentialsNoneSchema = z.object({
  client_id: oauthClientIdSchema,
})

export type OAuthClientCredentialsNone = z.infer<
  typeof oauthClientCredentialsNoneSchema
>

//

export const oauthClientCredentialsSchema = z.union([
  oauthClientCredentialsJwtBearerSchema,
  oauthClientCredentialsSecretPostSchema,
  // Must be last since it is less specific
  oauthClientCredentialsNoneSchema,
])

export type OAuthClientCredentials = z.infer<
  typeof oauthClientCredentialsSchema
>
