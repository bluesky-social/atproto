import { atprotoDidSchema } from '@atproto/did'
import { oauthTokenResponseSchema } from '@atproto/oauth-types'
import { z } from 'zod'

import { includesSpaceSeparatedValue, SpaceSeparatedValue } from './util'

export type AtprotoScope = SpaceSeparatedValue<'atproto'>
export const isAtprotoScope = (input: string): input is AtprotoScope =>
  includesSpaceSeparatedValue(input, 'atproto')
export const atprotoScopeSchema = z
  .string()
  .refine(isAtprotoScope, 'The "atproto" scope is required')

export const atprotoTokenResponseSchema = oauthTokenResponseSchema.extend({
  token_type: z.literal('DPoP'),
  sub: atprotoDidSchema,
  scope: atprotoScopeSchema,
  // OpenID is not compatible with atproto identities
  id_token: z.never().optional(),
})

export type AtprotoTokenResponse = z.infer<typeof atprotoTokenResponseSchema>
