import { z } from 'zod'
import {
  oauthAccessTokenSchema,
  oauthTokenTypeSchema,
} from '@atproto/oauth-types'
import { InvalidRequestError } from '../../errors/invalid-request-error.js'
import { WWWAuthenticateError } from '../../errors/www-authenticate-error.js'

export const authorizationHeaderSchema = z.tuple([
  oauthTokenTypeSchema,
  oauthAccessTokenSchema,
])

export const parseAuthorizationHeader = (header: unknown) => {
  if (typeof header !== 'string') {
    throw new WWWAuthenticateError(
      'invalid_request',
      'Authorization header required',
      { Bearer: {}, DPoP: {} },
    )
  }

  const parsed = authorizationHeaderSchema.safeParse(header.split(' '))
  if (!parsed.success) {
    throw new InvalidRequestError('Invalid authorization header')
  }
  return parsed.data
}
