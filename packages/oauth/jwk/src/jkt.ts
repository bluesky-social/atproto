import type { Jwk } from './jwk.js'

export function extractJktComponents(jwk: Jwk): Record<string, string> {
  switch (jwk.kty) {
    case 'EC':
      return { crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y }
    case 'OKP':
      return { crv: jwk.crv, kty: jwk.kty, x: jwk.x }
    case 'RSA':
      return { e: jwk.e, kty: jwk.kty, n: jwk.n }
    case 'oct':
      return { k: jwk.k, kty: jwk.kty }
    default:
      throw new TypeError(
        // @ts-expect-error
        `"kty" (Key Type) Parameter missing or unsupported: ${jwk.kty}`,
      )
  }
}
