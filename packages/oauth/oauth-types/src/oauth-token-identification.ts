import { z } from 'zod'
import { oauthAccessTokenSchema } from './oauth-access-token.js'
import { oauthRefreshTokenSchema } from './oauth-refresh-token.js'

export const oauthTokenIdentificationSchema = z.object({
  token: z.union([oauthAccessTokenSchema, oauthRefreshTokenSchema]),
  token_type_hint: z.enum(['access_token', 'refresh_token']).optional(),
})

export type OAuthTokenIdentification = z.infer<
  typeof oauthTokenIdentificationSchema
>
