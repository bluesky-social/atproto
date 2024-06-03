import { signedJwtSchema } from '@atproto/jwk'
import { z } from 'zod'

import { oauthAuthorizationDetailsSchema } from './oauth-authorization-details.js'
import { oauthTokenTypeSchema } from './oauth-token-type.js'

/**
 * @see {@link https://www.rfc-editor.org/rfc/rfc6749.html#section-5.1 | RFC 6749 (OAuth2), Section 5.1}
 */
export const oauthTokenResponseSchema = z
  .object({
    access_token: z.string(),
    token_type: oauthTokenTypeSchema,
    issuer: z.string().url().optional(),
    sub: z.string().optional(),
    scope: z.string().optional(),
    id_token: signedJwtSchema.optional(),
    refresh_token: z.string().optional(),
    expires_in: z.number().optional(),
    authorization_details: oauthAuthorizationDetailsSchema.optional(),
  })
  // https://www.rfc-editor.org/rfc/rfc6749.html#section-5.1
  // > The client MUST ignore unrecognized value names in the response.
  .passthrough()

/**
 * @see {@link oauthTokenResponseSchema}
 */
export type OAuthTokenResponse = z.infer<typeof oauthTokenResponseSchema>
