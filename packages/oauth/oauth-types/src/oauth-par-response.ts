import { z } from 'zod'

export const oauthParResponseSchema = z.object({
  request_uri: z.string(),
  expires_in: z.number().int().positive(),
})

export type OAuthParResponse = z.infer<typeof oauthParResponseSchema>
