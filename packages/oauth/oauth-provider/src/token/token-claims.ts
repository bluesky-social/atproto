import { z } from 'zod'
import { jwtPayloadSchema } from '@atproto/jwk'
import { clientIdSchema } from '../client/client-id.js'
import { Simplify } from '../lib/util/type.js'
import { subSchema } from '../oidc/sub.js'

export const tokenClaimsSchema = z.intersection(
  jwtPayloadSchema
    .pick({
      iat: true,
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
