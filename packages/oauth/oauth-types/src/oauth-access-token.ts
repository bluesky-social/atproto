import { z } from 'zod'

export const oauthAccessTokenSchema = z.string().min(1)
export type OAuthAccessToken = z.infer<typeof oauthAccessTokenSchema>
