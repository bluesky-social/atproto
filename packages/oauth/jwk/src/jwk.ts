import { z } from 'zod'
import { isFirstOccurrence } from './util'

export const PUBLIC_KEY_USAGE = ['verify', 'encrypt', 'wrapKey'] as const
export const publicKeyUsageSchema = z.enum(PUBLIC_KEY_USAGE)
export type PublicKeyUsage = (typeof PUBLIC_KEY_USAGE)[number]
export function isPublicKeyUsage(usage: unknown): usage is PublicKeyUsage {
  return (PUBLIC_KEY_USAGE as readonly unknown[]).includes(usage)
}

/**
 * Determines if the given key usage is consistent for "sig" (signature) public
 * key use.
 */
export function isSigKeyUsage(v: KeyUsage) {
  return v === 'verify'
}

/**
 * Determines if the given key usage is consistent for "enc" (encryption) public
 * key use.
 *
 * > When a key is used to wrap another key and a public key use
 * > designation for the first key is desired, the "enc" (encryption)
 * > key use value is used, since key wrapping is a kind of encryption.
 * > The "enc" value is also to be used for public keys used for key
 * > agreement operations.
 * @see {@link https://datatracker.ietf.org/doc/html/rfc7517#section-4.2}
 */
export function isEncKeyUsage(v: KeyUsage) {
  return v === 'encrypt' || v === 'wrapKey'
}

export const PRIVATE_KEY_USAGE = [
  'sign',
  'decrypt',
  'unwrapKey',
  'deriveKey',
  'deriveBits',
] as const
export const privateKeyUsageSchema = z.enum(PRIVATE_KEY_USAGE)
export type PrivateKeyUsage = (typeof PRIVATE_KEY_USAGE)[number]
export function isPrivateKeyUsage(usage: unknown): usage is PrivateKeyUsage {
  return (PRIVATE_KEY_USAGE as readonly unknown[]).includes(usage)
}

export const KEY_USAGE = [...PRIVATE_KEY_USAGE, ...PUBLIC_KEY_USAGE] as const
export const keyUsageSchema = z.enum(KEY_USAGE)
export type KeyUsage = (typeof KEY_USAGE)[number]

export const jwkBaseSchema = z.object({
  kty: z.string().min(1),
  alg: z.string().min(1).optional(),
  kid: z.string().min(1).optional(),
  ext: z.boolean().optional(),
  use: z.enum(['sig', 'enc']).optional(),
  key_ops: z
    .array(keyUsageSchema)
    // https://datatracker.ietf.org/doc/html/rfc7517#section-4.3
    // > Duplicate key operation values MUST NOT be present in the array.
    .refine((ops) => ops.every(isFirstOccurrence), {
      message: 'key_ops must not contain duplicates',
    })
    .optional(),

  x5c: z.array(z.string()).optional(), // X.509 Certificate Chain
  x5t: z.string().min(1).optional(), // X.509 Certificate SHA-1 Thumbprint
  'x5t#S256': z.string().min(1).optional(), // X.509 Certificate SHA-256 Thumbprint
  x5u: z.string().url().optional(), // X.509 URL
})

/**
 * @todo: properly implement this
 */
export const jwkRsaKeySchema = jwkBaseSchema.extend({
  kty: z.literal('RSA'),
  alg: z
    .enum(['RS256', 'RS384', 'RS512', 'PS256', 'PS384', 'PS512'])
    .optional(),

  n: z.string().min(1), // Modulus
  e: z.string().min(1), // Exponent

  d: z.string().min(1).optional(), // Private Exponent
  p: z.string().min(1).optional(), // First Prime Factor
  q: z.string().min(1).optional(), // Second Prime Factor
  dp: z.string().min(1).optional(), // First Factor CRT Exponent
  dq: z.string().min(1).optional(), // Second Factor CRT Exponent
  qi: z.string().min(1).optional(), // First CRT Coefficient
  oth: z
    .array(
      z.object({
        r: z.string().optional(),
        d: z.string().optional(),
        t: z.string().optional(),
      }),
    )
    .nonempty()
    .optional(), // Other Primes Info
})

export const jwkEcKeySchema = jwkBaseSchema.extend({
  kty: z.literal('EC'),
  alg: z.enum(['ES256', 'ES384', 'ES512']).optional(),
  crv: z.enum(['P-256', 'P-384', 'P-521']),

  x: z.string().min(1),
  y: z.string().min(1),

  d: z.string().min(1).optional(), // ECC Private Key
})

export const jwkEcSecp256k1KeySchema = jwkBaseSchema.extend({
  kty: z.literal('EC'),
  alg: z.enum(['ES256K']).optional(),
  crv: z.enum(['secp256k1']),

  x: z.string().min(1),
  y: z.string().min(1),

  d: z.string().min(1).optional(), // ECC Private Key
})

export const jwkOkpKeySchema = jwkBaseSchema.extend({
  kty: z.literal('OKP'),
  alg: z.enum(['EdDSA']).optional(),
  crv: z.enum(['Ed25519', 'Ed448']),

  x: z.string().min(1),
  d: z.string().min(1).optional(), // ECC Private Key
})

export const jwkSymKeySchema = jwkBaseSchema.extend({
  kty: z.literal('oct'), // Octet Sequence (used to represent symmetric keys)
  alg: z.enum(['HS256', 'HS384', 'HS512']).optional(),

  k: z.string(), // Key Value (base64url encoded)
})

export const jwkUnknownKeySchema = jwkBaseSchema.extend({
  kty: z
    .string()
    .refine((v) => v !== 'RSA' && v !== 'EC' && v !== 'OKP' && v !== 'oct'),
})

export const jwkSchema = z
  .union([
    jwkUnknownKeySchema,
    jwkRsaKeySchema,
    jwkEcKeySchema,
    jwkEcSecp256k1KeySchema,
    jwkOkpKeySchema,
    jwkSymKeySchema,
  ])
  // https://datatracker.ietf.org/doc/html/rfc7517#section-4.2
  // > The "use" (public key use) parameter identifies the intended use of the
  // > public key
  .refine((k): boolean => k.use == null || isPublicJwk(k), {
    message: '"use" can only be used with public keys',
    path: ['use'],
  })
  // https://datatracker.ietf.org/doc/html/rfc7517#section-4.3
  // > The "use" and "key_ops" JWK members SHOULD NOT be used together;
  // > however, if both are used, the information they convey MUST be
  // > consistent.
  .refine(
    (k): boolean =>
      k.use == null ||
      k.key_ops == null ||
      (k.use === 'sig' && k.key_ops.every(isSigKeyUsage)) ||
      (k.use === 'enc' && k.key_ops.every(isEncKeyUsage)),
    {
      message: '"key_ops" must be consistent with "use"',
      path: ['key_ops'],
    },
  )
  .refine(
    (k): boolean => !k.key_ops?.some(isPrivateKeyUsage) || isPrivateJwk(k),
    {
      message: 'private key usage not allowed for public keys',
      path: ['key_ops'],
    },
  )

export type Jwk = z.infer<typeof jwkSchema>

/** @deprecated use {@link jwkSchema} */
export const jwkValidator = jwkSchema

export const jwkPubSchema = jwkSchema
  .refine(isPublicJwk, 'private key not allowed')
  .refine((k) => k.kid != null, { message: 'kid is required', path: ['kid'] })

export const jwkPrivateSchema = jwkSchema.refine(
  isPrivateJwk,
  'private key required',
)

export function isSharedSecretJwk<J extends Readonly<Jwk>>(
  jwk: J,
): jwk is Extract<J, { k: NonNullable<unknown> }> {
  return 'k' in jwk && jwk.k != null
}

export function isPrivateSecretJwk<J extends Readonly<Jwk>>(
  jwk: J,
): jwk is Extract<J, { d: NonNullable<unknown> }> {
  return 'd' in jwk && jwk.d != null
}

export function isPrivateJwk<J extends Readonly<Jwk>>(jwk: J) {
  return isPrivateSecretJwk(jwk) || isSharedSecretJwk(jwk)
}

export function isPublicJwk<J extends Readonly<Jwk>>(
  jwk: J,
): jwk is
  | Exclude<J, { d: NonNullable<unknown> }>
  | Exclude<J, { k: NonNullable<unknown> }> {
  return !isPrivateSecretJwk(jwk) && !isSharedSecretJwk(jwk)
}
