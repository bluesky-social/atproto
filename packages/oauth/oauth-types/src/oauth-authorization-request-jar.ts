import { z } from 'zod'
import { signedJwtSchema, unsignedJwtSchema } from '@atproto/jwk'

export const oauthAuthorizationRequestJarSchema = z.object({
  /**
   * AuthorizationRequest inside a JWT:
   * - "iat" is required and **MUST** be less than one minute
   *
   * @see {@link https://datatracker.ietf.org/doc/html/rfc9101}
   */
  request: z.union([signedJwtSchema, unsignedJwtSchema]),
})

export type OAuthAuthorizationRequestJar = z.infer<
  typeof oauthAuthorizationRequestJarSchema
>
