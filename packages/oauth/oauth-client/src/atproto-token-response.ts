import { z } from 'zod'
import { atprotoDidSchema } from '@atproto/did'
import { oauthTokenResponseSchema } from '@atproto/oauth-types'
import { SpaceSeparatedValue, includesSpaceSeparatedValue } from './util'

export type AtprotoScope = SpaceSeparatedValue<'atproto'>
export function isAtprotoScope(input: unknown): input is AtprotoScope {
  return (
    typeof input === 'string' && includesSpaceSeparatedValue(input, 'atproto')
  )
}
export const atprotoScopeSchema = z.custom<AtprotoScope>(
  isAtprotoScope,
  'The "atproto" scope is required',
)

export const atprotoTokenResponseSchema = oauthTokenResponseSchema.extend({
  token_type: z.literal('DPoP'),
  sub: atprotoDidSchema,
  scope: atprotoScopeSchema,
  // OpenID is not compatible with atproto identities
  id_token: z.never().optional(),
})

export type AtprotoTokenResponse = z.output<typeof atprotoTokenResponseSchema>
