import {
  oauthClientIdSchema,
  oauthClientMetadataSchema,
} from '@atproto/oauth-types'
import z from 'zod'

// TODO: Rename these types without the OAuth prefix. All oauth related types
// are in the oauth-types package. The following types are specific to this
// package, not to oauth in general.

export type OAuthAuthorizeOptions = {
  display?: 'page' | 'popup' | 'touch' | 'wap'
  id_token_hint?: string
  max_age?: number
  prompt?: 'login' | 'none' | 'consent' | 'select_account'
  scope?: string
  state?: string
  ui_locales?: string
}

export const oauthClientMetadataIdSchema = oauthClientMetadataSchema.extend({
  client_id: oauthClientIdSchema.url(),
})

export type OAuthClientMetadataId = z.infer<typeof oauthClientMetadataIdSchema>
