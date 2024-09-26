import { z } from 'zod'

export const oauthRefreshTokenSchema = z.string().min(1)
export type OAuthRefreshToken = z.infer<typeof oauthRefreshTokenSchema>
