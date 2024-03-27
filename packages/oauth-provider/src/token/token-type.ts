import { z } from 'zod'

// Case insensitive input, normalized output
export const tokenTypeSchema = z.union([
  z
    .string()
    .regex(/^DPoP$/i)
    .transform(() => 'DPoP' as const),
  z
    .string()
    .regex(/^Bearer$/i)
    .transform(() => 'Bearer' as const),
])

export type TokenType = z.infer<typeof tokenTypeSchema>
