import { z } from 'zod'

export const oauthRequestUriSchema = z.string().min(1)

export type OAuthRequestUri = z.infer<typeof oauthRequestUriSchema>
