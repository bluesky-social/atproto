import { TypeOf, z } from 'zod'
import { atprotoDidSchema } from '@atproto/did'
import { atprotoOAuthScopeSchema } from './atproto-oauth-scope'
import { oauthTokenResponseSchema } from './oauth-token-response.js'

export const atprotoOAuthTokenResponseSchema = oauthTokenResponseSchema.extend({
  token_type: z.literal('DPoP'),
  sub: atprotoDidSchema,
  scope: atprotoOAuthScopeSchema,
  // OpenID is not compatible with atproto identities
  id_token: z.never().optional(),
})

export type AtprotoOAuthTokenResponse = TypeOf<
  typeof atprotoOAuthTokenResponseSchema
>
