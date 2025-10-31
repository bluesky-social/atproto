import { z } from 'zod'
import { jwkPubSchema, jwkSchema } from './jwk.js'

/**
 * JSON Web Key Set schema. The keys set, in this context, represents a
 * collection of JSON Web Keys (JWKs), that can be both public and private.
 */
export const jwksSchema = z.object({
  keys: z.array(z.unknown()).transform((input) => {
    // > Implementations SHOULD ignore JWKs within a JWK Set that use "kty"
    // > (key type) values that are not understood by them, that are missing
    // > required members, or for which values are out of the supported
    // > ranges.
    return input
      .map((item) => jwkSchema.safeParse(item))
      .filter((res) => res.success)
      .map((res) => res.data)
  }),
})

export type Jwks = z.output<typeof jwksSchema>

/**
 * Public JSON Web Key Set schema.
 */
export const jwksPubSchema = z.object({
  keys: z.array(z.unknown()).transform((input) => {
    // > Implementations SHOULD ignore JWKs within a JWK Set that use "kty"
    // > (key type) values that are not understood by them, that are missing
    // > required members, or for which values are out of the supported
    // > ranges.
    return input
      .map((item) => jwkPubSchema.safeParse(item))
      .filter((res) => res.success)
      .map((res) => res.data)
  }),
})

export type JwksPub = z.output<typeof jwksPubSchema>
