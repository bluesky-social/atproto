import { jwtPayloadSchema } from '@atproto/jwk'
import { oauthClientIdSchema } from '@atproto/oauth-types'
import z from 'zod'

import { subSchema } from '../oidc/sub.js'
import { tokenIdSchema } from '../token/token-id.js'
import { Simplify } from '../lib/util/type.js'

export const signedTokenPayloadSchema = z.intersection(
  jwtPayloadSchema
    .pick({
      exp: true,
      iat: true,
      iss: true,
      aud: true,
    })
    .required(),
  jwtPayloadSchema
    .omit({
      exp: true,
      iat: true,
      iss: true,
      aud: true,
    })
    .partial()
    .extend({
      jti: tokenIdSchema,
      sub: subSchema,
      client_id: oauthClientIdSchema,
    }),
)

export type SignedTokenPayload = Simplify<
  z.infer<typeof signedTokenPayloadSchema>
>
