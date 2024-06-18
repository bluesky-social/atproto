import { signedJwtSchema, unsignedJwtSchema } from '@atproto/jwk'
import {
  oauthAuthenticationRequestParametersSchema,
  oauthClientIdentificationSchema,
} from '@atproto/oauth-types'
import { z } from 'zod'

import { requestUriSchema } from './request-uri.js'

export const authorizationRequestJarSchema = z.object({
  /**
   * AuthorizationRequest inside a JWT:
   * - "iat" is required and **MUST** be less than one minute
   *
   * @see {@link https://datatracker.ietf.org/doc/html/rfc9101}
   */
  request: z.union([signedJwtSchema, unsignedJwtSchema]),
})

export type AuthorizationRequestJar = z.infer<
  typeof authorizationRequestJarSchema
>

export const pushedAuthorizationRequestSchema = z.intersection(
  oauthClientIdentificationSchema,
  z.union([
    oauthAuthenticationRequestParametersSchema,
    authorizationRequestJarSchema,
    //
  ]),
)

export type PushedAuthorizationRequest = z.infer<
  typeof pushedAuthorizationRequestSchema
>

export const authorizationRequestQuerySchema = z.intersection(
  oauthClientIdentificationSchema,
  z.union([
    oauthAuthenticationRequestParametersSchema,
    authorizationRequestJarSchema,
    z.object({ request_uri: requestUriSchema }),
  ]),
)

export type AuthorizationRequestQuery = z.infer<
  typeof authorizationRequestQuerySchema
>
