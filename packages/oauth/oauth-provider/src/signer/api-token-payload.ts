import type { z } from 'zod'
import { didSchema } from '@atproto/did'
import { jwtPayloadSchema } from '@atproto/jwk'
import { deviceIdSchema } from '../device/device-id.js'
import { requestUriSchema } from '../request/request-uri.js'

export const apiTokenPayloadSchema = jwtPayloadSchema
  .extend({
    sub: didSchema,

    deviceId: deviceIdSchema,
    // If the token is bound to a particular authorization request, it can only
    // be used in the context of that request.
    requestUri: requestUriSchema.optional(),
  })
  .passthrough()

export type ApiTokenPayload = z.infer<typeof apiTokenPayloadSchema>
