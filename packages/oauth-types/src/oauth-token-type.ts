import { z } from 'zod'

// Case insensitive input, normalized output
export const oauthTokenTypeSchema = z.union([
  z
    .string()
    .regex(/^DPoP$/i)
    .transform(() => 'DPoP' as const),
  z
    .string()
    .regex(/^Bearer$/i)
    .transform(() => 'Bearer' as const),
])

export type OAuthTokenType = z.infer<typeof oauthTokenTypeSchema>
