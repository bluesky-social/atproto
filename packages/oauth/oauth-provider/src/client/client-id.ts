import { oauthClientIdSchema, OAuthClientId } from '@atproto/oauth-types'

export type ClientId = OAuthClientId
export const clientIdSchema = oauthClientIdSchema
