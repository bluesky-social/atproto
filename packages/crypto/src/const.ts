export const P256_DID_PREFIX = new Uint8Array([0x80, 0x24])

/**
 * @see {@link https://github.com/multiformats/multicodec/blob/f18c7ba/table.csv#L93}
 */
export const SECP256K1_DID_PREFIX = new Uint8Array([0xe7, 0x01])

/**
 * @see {@link https://github.com/multiformats/multicodec/blob/f18c7ba/table.csv#L98}
 */
export const ED25519_DID_PREFIX = new Uint8Array([0xed])

/**
 * @see {@link https://github.com/multiformats/multibase/blob/a82ac31/multibase.csv#L21}
 */
export const BASE58_MULTIBASE_PREFIX = 'z'

/**
 * @see {@link https://w3c-ccg.github.io/did-method-key/}
 */
export const DID_KEY_PREFIX = 'did:key:'

/**
 * @see {@link https://iana.org/assignments/jose/jose.xhtml#web-signature-encryption-algorithms}
 */
export const ED25519_JWT_ALG = 'EdDSA'

/**
 * @see {@link https://iana.org/assignments/jose/jose.xhtml#web-signature-encryption-algorithms}
 */
export const P256_JWT_ALG = 'ES256'

/**
 * @see {@link https://iana.org/assignments/jose/jose.xhtml#web-signature-encryption-algorithms}
 */
export const SECP256K1_JWT_ALG = 'ES256K'
