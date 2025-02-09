import { z } from 'zod'
import { signedJwtSchema } from '@atproto/jwk'
import { oauthAuthorizationDetailsSchema } from './oauth-authorization-details.js'
import { oauthTokenTypeSchema } from './oauth-token-type.js'

/**
 * @see {@link https://www.rfc-editor.org/rfc/rfc6749.html#section-5.1 | RFC 6749 (OAuth2), Section 5.1}
 */
export const oauthTokenResponseSchema = z
  .object({
    // https://www.rfc-editor.org/rfc/rfc6749.html#section-5.1
    access_token: z.string(),
    token_type: oauthTokenTypeSchema,
    scope: z.string().optional(),
    refresh_token: z.string().optional(),
    expires_in: z.number().optional(),
    // https://openid.net/specs/openid-connect-core-1_0.html#TokenResponse
    id_token: signedJwtSchema.optional(),
    // https://datatracker.ietf.org/doc/html/rfc9396#name-enriched-authorization-deta
    authorization_details: oauthAuthorizationDetailsSchema.optional(),
  })
  // https://www.rfc-editor.org/rfc/rfc6749.html#section-5.1
  // > The client MUST ignore unrecognized value names in the response.
  .passthrough()

/**
 * @see {@link oauthTokenResponseSchema}
 */
export type OAuthTokenResponse = z.infer<typeof oauthTokenResponseSchema>
