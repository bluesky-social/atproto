import { z } from 'zod'
import { oauthClientIdSchema } from './oauth-client-id.js'
import { oauthRefreshTokenSchema } from './oauth-refresh-token.js'

export const oauthRefreshTokenGrantTokenRequestSchema = z.object({
  grant_type: z.literal('refresh_token'),
  refresh_token: oauthRefreshTokenSchema,
  client_id: oauthClientIdSchema,
})

export type OAuthRefreshTokenGrantTokenRequest = z.infer<
  typeof oauthRefreshTokenGrantTokenRequestSchema
>
