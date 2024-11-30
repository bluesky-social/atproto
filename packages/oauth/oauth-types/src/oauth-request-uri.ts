import { z } from 'zod'

export const oauthRequestUriSchema = z.string()

export type OAuthRequestUri = z.infer<typeof oauthRequestUriSchema>
