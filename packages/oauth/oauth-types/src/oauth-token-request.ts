import { z } from 'zod'
import { oauthAuthorizationCodeGrantTokenRequestSchema } from './oauth-authorization-code-grant-token-request.js'
import { oauthClientCredentialsGrantTokenRequestSchema } from './oauth-client-credentials-grant-token-request.js'
import { oauthPasswordGrantTokenRequestSchema } from './oauth-password-grant-token-request.js'
import { oauthRefreshTokenGrantTokenRequestSchema } from './oauth-refresh-token-grant-token-request.js'

export const oauthTokenRequestSchema = z.discriminatedUnion('grant_type', [
  oauthAuthorizationCodeGrantTokenRequestSchema,
  oauthRefreshTokenGrantTokenRequestSchema,
  oauthPasswordGrantTokenRequestSchema,
  oauthClientCredentialsGrantTokenRequestSchema,
])

export type OAuthTokenRequest = z.infer<typeof oauthTokenRequestSchema>
