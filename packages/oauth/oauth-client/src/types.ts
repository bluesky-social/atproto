import {
  OAuthAuthorizationRequestParameters,
  oauthClientIdSchema,
  oauthClientMetadataSchema,
} from '@atproto/oauth-types'
import z from 'zod'

import { Simplify } from './util.js'

// Note: These types are not prefixed with `OAuth` because they are not specific
// to OAuth. They are specific to this packages. OAuth specific types are in
// `@atproto/oauth-types`.

export type AuthorizeOptions = Simplify<
  Omit<
    OAuthAuthorizationRequestParameters,
    | 'client_id'
    | 'response_mode'
    | 'response_type'
    | 'login_hint'
    | 'code_challenge'
    | 'code_challenge_method'
  > & {
    signal?: AbortSignal
  }
>

export const clientMetadataSchema = oauthClientMetadataSchema.extend({
  client_id: oauthClientIdSchema.url(),
})

export type ClientMetadata = z.infer<typeof clientMetadataSchema>
