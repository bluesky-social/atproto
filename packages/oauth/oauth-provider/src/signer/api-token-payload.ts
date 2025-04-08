import { z } from 'zod'
import { jwtPayloadSchema } from '@atproto/jwk'
import { subSchema } from '../oidc/sub.js'
import { requestUriSchema } from '../request/request-uri.js'

export const apiTokenPayloadSchema = jwtPayloadSchema
  .partial()
  .extend({
    sub: subSchema,
    exp: z.number().int(),
    iat: z.number().int(),
    iss: z.string().min(1),
    aud: z.string().min(1),

    // If the token is bound to a particular authorization request, it can only
    // be used in the context of that request.
    requestUri: requestUriSchema.optional(),
  })
  .passthrough()

export type ApiTokenPayload = z.infer<typeof apiTokenPayloadSchema>
