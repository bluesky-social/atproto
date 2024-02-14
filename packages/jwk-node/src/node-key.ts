import { KeyObject, createPublicKey } from 'node:crypto'

import {
  Jwk,
  Key,
  KeyLike,
  either,
  jwkPubSchema,
  jwkSchema,
} from '@atproto/jwk'
import { exportJWK, importJWK, importPKCS8 } from 'jose'

export type Importable = string | KeyObject | KeyLike | Jwk

function asPublicJwk(
  { kid, use, alg }: { kid?: string; use?: 'sig' | 'enc'; alg?: string },
  publicKey: KeyObject,
) {
  const jwk = publicKey.export({ format: 'jwk' })

  if (use) jwk['use'] = use
  if (kid) jwk['kid'] = kid
  if (alg) jwk['alg'] = alg

  return jwkPubSchema.parse(jwk)
}

export class NodeKey extends Key {
  static async fromImportable(
    input: Importable,
    kid: string,
  ): Promise<NodeKey> {
    if (typeof input === 'string') {
      // PKCS8 (string)
      if (input.startsWith('-----')) {
        return this.fromPKCS8(kid, input)
      }

      // Jwk (string)
      if (input.startsWith('{')) {
        return this.fromJWK(input, kid)
      }

      throw new TypeError('Invalid input')
    }

    if (typeof input === 'object') {
      // KeyObject
      if (input instanceof KeyObject) {
        return this.fromKeyObject(kid, input)
      }

      // Jwk
      if (
        !(input instanceof Uint8Array) &&
        ('kty' in input || 'alg' in input)
      ) {
        return this.fromJWK(input, kid)
      }

      // KeyLike
      return this.fromJWK(await exportJWK(input), kid)
    }

    throw new TypeError('Invalid input')
  }

  static async fromPKCS8(
    kid: string,
    pem: string,
    use?: 'sig' | 'enc',
    alg?: string,
  ): Promise<NodeKey> {
    const privateKey = await importPKCS8<KeyObject>(pem, '', {
      extractable: true,
    })

    return this.fromKeyObject(kid, privateKey, use, alg)
  }

  static async fromKeyObject(
    kid: string,
    privateKey: KeyObject,
    inputUse?: 'sig' | 'enc',
    inputAlg?: string,
  ): Promise<NodeKey> {
    const jwk = jwkSchema.parse(privateKey.export({ format: 'jwk' }))

    const alg = either(jwk.alg, inputAlg)
    const use = either(jwk.use, inputUse) || 'sig'

    const privateJwk = { ...jwk, use, kid, alg }

    if (privateKey.asymmetricKeyType) {
      const publicKey = createPublicKey(privateKey)
      const publicJwk = asPublicJwk(privateJwk, publicKey)
      return new NodeKey({ privateJwk, privateKey, publicJwk, publicKey })
    } else {
      return new NodeKey({ privateJwk, privateKey })
    }
  }

  static async fromJWK(
    input: string | Record<string, unknown>,
    inputKid?: string,
  ): Promise<NodeKey> {
    const jwk = jwkSchema.parse(
      typeof input === 'string' ? JSON.parse(input) : input,
    )

    const kid = either(jwk.kid, inputKid)
    const alg = jwk.alg
    const use = jwk.use || 'sig'

    // @ts-expect-error https://github.com/panva/jose/issues/634
    const privateKey = await importJWK<KeyObject>(jwk)
    if (!(privateKey instanceof KeyObject)) {
      throw new TypeError('Expected an asymmetric key')
    }
    const privateJwk = { ...jwk, kid, alg, use }

    const publicKey = createPublicKey(privateKey)
    const publicJwk = asPublicJwk(privateJwk, publicKey)

    return new NodeKey({ privateJwk, privateKey, publicJwk, publicKey })
  }
}
