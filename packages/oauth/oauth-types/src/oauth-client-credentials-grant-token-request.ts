import { z } from 'zod'

export const oauthClientCredentialsGrantTokenRequestSchema = z.object({
  grant_type: z.literal('client_credentials'),
})

export type OAuthClientCredentialsGrantTokenRequest = z.infer<
  typeof oauthClientCredentialsGrantTokenRequestSchema
>
