import { z } from 'zod'

export const oauthClientIdSchema = z.string().min(1)
export type OAuthClientId = z.infer<typeof oauthClientIdSchema>
