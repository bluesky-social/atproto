import { JwkError } from './errors.js'
import { JwkBase, isEncKeyUsage, isSigKeyUsage } from './jwk.js'

// Copy variable to prevent bundlers from automatically polyfilling "process" (e.g. parcel)
const { process } = globalThis
const IS_NODE_RUNTIME =
  typeof process !== 'undefined' && typeof process?.versions?.node === 'string'

export function* jwkAlgorithms(jwk: JwkBase): Generator<string, void, unknown> {
  // Ed25519, Ed448, and secp256k1 always have "alg"

  if (typeof jwk.alg === 'string') {
    yield jwk.alg
    return
  }

  switch (jwk.kty) {
    case 'EC': {
      if (jwkSupportsEnc(jwk)) {
        yield 'ECDH-ES'
        yield 'ECDH-ES+A128KW'
        yield 'ECDH-ES+A192KW'
        yield 'ECDH-ES+A256KW'
      }

      if (jwkSupportsSig(jwk)) {
        const crv = 'crv' in jwk ? jwk.crv : undefined
        switch (crv) {
          case 'P-256':
          case 'P-384':
            yield `ES${crv.slice(-3)}`
            break
          case 'P-521':
            yield 'ES512'
            break
          case 'secp256k1':
            if (IS_NODE_RUNTIME) yield 'ES256K'
            break
          default:
            throw new JwkError(`Unsupported crv "${crv}"`)
        }
      }

      return
    }

    case 'OKP': {
      if (!jwk.use) throw new JwkError('Missing "use" Parameter value')
      yield 'ECDH-ES'
      yield 'ECDH-ES+A128KW'
      yield 'ECDH-ES+A192KW'
      yield 'ECDH-ES+A256KW'
      return
    }

    case 'RSA': {
      if (jwkSupportsEnc(jwk)) {
        yield 'RSA-OAEP'
        yield 'RSA-OAEP-256'
        yield 'RSA-OAEP-384'
        yield 'RSA-OAEP-512'
        if (IS_NODE_RUNTIME) yield 'RSA1_5'
      }

      if (jwkSupportsSig(jwk)) {
        yield 'PS256'
        yield 'PS384'
        yield 'PS512'
        yield 'RS256'
        yield 'RS384'
        yield 'RS512'
      }

      return
    }

    case 'oct': {
      if (jwkSupportsEnc(jwk)) {
        yield 'A128GCMKW'
        yield 'A192GCMKW'
        yield 'A256GCMKW'
        yield 'A128KW'
        yield 'A192KW'
        yield 'A256KW'
      }

      if (jwkSupportsSig(jwk)) {
        yield 'HS256'
        yield 'HS384'
        yield 'HS512'
      }

      return
    }

    default:
      throw new JwkError(`Unsupported kty "${jwk.kty}"`)
  }
}

function jwkSupportsEnc(jwk: JwkBase): boolean {
  return (
    jwk.key_ops?.some(isEncKeyUsage) ?? (jwk.use == null || jwk.use === 'enc')
  )
}

function jwkSupportsSig(jwk: JwkBase): boolean {
  return (
    jwk.key_ops?.some(isSigKeyUsage) ?? (jwk.use == null || jwk.use === 'sig')
  )
}
