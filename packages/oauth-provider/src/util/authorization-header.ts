import { z } from 'zod'

import { accessTokenSchema } from '../access-token/access-token.js'
import { InvalidRequestError } from '../errors/invalid-request-error.js'
import { WWWAuthenticateError } from '../errors/www-authenticate-error.js'
import { tokenTypeSchema } from '../token/token-type.js'

export const authorizationHeaderSchema = z.tuple([
  tokenTypeSchema,
  accessTokenSchema,
])

export const parseAuthorizationHeader = (header?: string) => {
  if (header == null) {
    throw new WWWAuthenticateError(
      'invalid_request',
      'Authorization header required',
      { Bearer: {}, DPoP: {} },
    )
  }

  const parsed = authorizationHeaderSchema.safeParse(header.split(' ', 2))
  if (!parsed.success) {
    throw new InvalidRequestError('Invalid authorization header')
  }
  return parsed.data
}
