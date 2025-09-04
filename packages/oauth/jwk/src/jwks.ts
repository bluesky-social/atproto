import { z } from 'zod'
import { jwkPubSchema, jwkSchema } from './jwk.js'

/**
 * JSON Web Key Set schema. The keys set, in this context, represents a
 * collection of JSON Web Keys (JWKs), that can be both public and private.
 */
export const jwksSchema = z.object({
  // > Implementations SHOULD ignore JWKs within a JWK Set that use "kty"
  // > (key type) values that are not understood by them, that are missing
  // > required members, or for which values are out of the supported
  // > ranges.
  keys: z.array(jwkSchema),
})

export type Jwks = z.infer<typeof jwksSchema>

/**
 * Public JSON Web Key Set schema.
 */
export const jwksPubSchema = z.object({
  // > Implementations SHOULD ignore JWKs within a JWK Set that use "kty"
  // > (key type) values that are not understood by them, that are missing
  // > required members, or for which values are out of the supported
  // > ranges.
  keys: z.array(jwkPubSchema),
})

export type JwksPub = z.infer<typeof jwksPubSchema>
