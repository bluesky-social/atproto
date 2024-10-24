import { z } from 'zod'
import { oauthRefreshTokenSchema } from './oauth-refresh-token.js'

export const oauthRefreshTokenGrantTokenRequestSchema = z.object({
  grant_type: z.literal('refresh_token'),
  refresh_token: oauthRefreshTokenSchema,
})

export type OAuthRefreshTokenGrantTokenRequest = z.infer<
  typeof oauthRefreshTokenGrantTokenRequestSchema
>
