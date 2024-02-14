import { z } from 'zod'

import { accessTokenSchema } from '../access-token/access-token.js'
import { UnauthorizedError } from '../errors/unauthorized-error.js'
import { tokenTypeSchema } from '../token/token-type.js'

export const authorizationHeaderSchema = z.tuple([
  tokenTypeSchema,
  accessTokenSchema,
])

export const parseAuthorizationHeader = (header?: string) => {
  const parsed = authorizationHeaderSchema.safeParse(header?.split(' ', 2))
  if (!parsed.success) {
    throw new UnauthorizedError('Invalid authorization header', {
      Bearer: {},
      DPoP: {},
    })
  }
  return parsed.data
}
