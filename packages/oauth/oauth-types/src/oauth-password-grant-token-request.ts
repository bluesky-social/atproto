import { z } from 'zod'

export const oauthPasswordGrantTokenRequestSchema = z.object({
  grant_type: z.literal('password'),
  username: z.string(),
  password: z.string(),
})

export type OAuthPasswordGrantTokenRequest = z.infer<
  typeof oauthPasswordGrantTokenRequestSchema
>
