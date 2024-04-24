import { z } from 'zod'

export const oauthParResponseSchema = z.object({
  request_uri: z.string(),
})

export type OAuthParResponse = z.infer<typeof oauthParResponseSchema>
