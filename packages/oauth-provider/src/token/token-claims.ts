import { jwtPayloadSchema } from '@atproto/jwk'
import z from 'zod'

import { clientIdSchema } from '../client/client-id.js'
import { subSchema } from '../oidc/sub.js'
import { Simplify } from '../util/type.js'

export const tokenClaimsSchema = z.intersection(
  jwtPayloadSchema
    .pick({
      exp: true,
      aud: true,
    })
    .required(),
  jwtPayloadSchema
    .omit({
      exp: true,
      iat: true,
      iss: true,
      aud: true,
      jti: true,
    })
    .partial()
    .extend({
      sub: subSchema,
      client_id: clientIdSchema,
    }),
)

export type TokenClaims = Simplify<z.infer<typeof tokenClaimsSchema>>
