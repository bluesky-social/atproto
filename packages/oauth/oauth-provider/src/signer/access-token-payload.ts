import { z } from 'zod'
import { didSchema } from '@atproto/did'
import { jwtPayloadSchema } from '@atproto/jwk'
import { clientIdSchema } from '../client/client-id.js'
import { tokenIdSchema } from '../token/token-id.js'

export const accessTokenPayloadSchema = jwtPayloadSchema
  .partial()
  .extend({
    // Following are required
    jti: tokenIdSchema,
    sub: didSchema,
    exp: z.number().int(),
    iat: z.number().int(),
    iss: z.string().min(1),

    // @NOTE "aud", "scope", "client_id" are not required, as are stored in the
    // DB in 'light' access token mode.

    // Restrict type of following
    client_id: clientIdSchema.optional(),
  })
  .passthrough()

export type AccessTokenPayload = z.infer<typeof accessTokenPayloadSchema>
