import { z } from 'zod'
import { jwkPubSchema, jwkSchema } from './jwk.js'

/**
 * JSON Web Key Set schema. The keys set, in this context, represents a
 * collection of JSON Web Keys (JWKs), that can be both public and private.
 */
export const jwksSchema = z.object({
  keys: z.array(jwkSchema),
})

export type Jwks = z.infer<typeof jwksSchema>

/**
 * Public JSON Web Key Set schema. All keys must be public keys, have a `kid`,
 * and `use` or `key_ops` defined.
 */
export const jwksPubSchema = z.object({
  keys: z.array(jwkPubSchema),
})

export type JwksPub = z.infer<typeof jwksPubSchema>
