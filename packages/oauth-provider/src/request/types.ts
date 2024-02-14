import { jwtSchema } from '@atproto/jwk'
import { z } from 'zod'

import { clientIdentificationSchema } from '../client/client-credentials.js'
import { authorizationParametersSchema } from '../parameters/authorization-parameters.js'
import { requestUriSchema } from './request-uri.js'

export const authorizationRequestJarSchema = z.object({
  /**
   * AuthorizationRequest inside a JWT:
   * - "iat" is required and **MUST** be less than one minute
   *
   * @see {@link https://datatracker.ietf.org/doc/html/rfc9101}
   * @see {AuthorizationServer.getAuthorizationRequest}
   */
  request: jwtSchema,
})

export type AuthorizationRequestJar = z.infer<
  typeof authorizationRequestJarSchema
>

export const pushedAuthorizationRequestSchema = z.intersection(
  clientIdentificationSchema,
  z.union([
    authorizationParametersSchema,
    authorizationRequestJarSchema,
    //
  ]),
)

export type PushedAuthorizationRequest = z.infer<
  typeof pushedAuthorizationRequestSchema
>

export const authorizationRequestQuerySchema = z.intersection(
  clientIdentificationSchema,
  z.union([
    authorizationParametersSchema,
    authorizationRequestJarSchema,
    z.object({ request_uri: requestUriSchema }),
  ]),
)

export type AuthorizationRequestQuery = z.infer<
  typeof authorizationRequestQuerySchema
>
