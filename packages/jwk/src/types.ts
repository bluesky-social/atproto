export type JWSAlgorithm =
  // HMAC
  | 'HS256'
  | 'HS384'
  | 'HS512'
  // RSA
  | 'PS256'
  | 'PS384'
  | 'PS512'
  | 'RS256'
  | 'RS384'
  | 'RS512'
  // EC
  | 'ES256'
  | 'ES256K'
  | 'ES384'
  | 'ES512'
  // OKP
  | 'EdDSA'

// Runtime specific key representation or secret
export type KeyLike = { type: string } | Uint8Array
