import { z } from 'zod'
import { jwkPubSchema, jwkSchema } from './jwk.js'

export const jwksSchema = z.object({
  keys: z.array(jwkSchema),
})

export type Jwks = z.infer<typeof jwksSchema>

export const jwksPubSchema = z.object({
  keys: z.array(jwkPubSchema),
})

export type JwksPub = z.infer<typeof jwksPubSchema>
