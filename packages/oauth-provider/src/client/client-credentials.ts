import { z } from 'zod'

import { clientIdSchema } from './client-id.js'

export const CLIENT_ASSERTION_TYPE_JWT_BEARER =
  'urn:ietf:params:oauth:client-assertion-type:jwt-bearer'

export const clientJwtBearerAssertionSchema = z.object({
  client_id: clientIdSchema,
  client_assertion_type: z.literal(CLIENT_ASSERTION_TYPE_JWT_BEARER),
  /**
   * - "sub" the subject MUST be the "client_id" of the OAuth client
   * - "iat" is required and MUST be less than one minute
   * - "aud" must containing a value that identifies the authorization server
   * - The JWT MAY contain a "jti" (JWT ID) claim that provides a unique identifier for the token.
   * - Note that the authorization server may reject JWTs with an "exp" claim value that is unreasonably far in the future.
   *
   * @see {@link https://datatracker.ietf.org/doc/html/draft-ietf-oauth-jwt-bearer-11#section-3}
   */
  client_assertion: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/),
})

export const clientSecretPostSchema = z.object({
  client_id: clientIdSchema,
  client_secret: z.string(),
})

export const clientCredentialsSchema = z.union([
  clientJwtBearerAssertionSchema,
  clientSecretPostSchema,
])

export type ClientCredentials = z.infer<typeof clientCredentialsSchema>

export const clientIdentificationSchema = z.union([
  clientCredentialsSchema,
  // Must be last since it is less specific
  z.object({ client_id: clientIdSchema }),
])

export type ClientIdentification = z.infer<typeof clientIdentificationSchema>
