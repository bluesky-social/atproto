import { webcrypto } from 'one-webcrypto'
import { P256_JWT_ALG } from '../const'
import { parseDidKey } from '../did'

export const importKeypairJwk = async (
  jwk: JsonWebKey,
  exportable = false,
): Promise<CryptoKeyPair> => {
  const privateKey = await webcrypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    exportable,
    ['sign'],
  )
  const { kty, crv, x, y } = jwk
  const pubKeyJwk = { kty, crv, x, y }
  const publicKey = await webcrypto.subtle.importKey(
    'jwk',
    pubKeyJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['verify'],
  )
  return { privateKey, publicKey }
}

export const verifyDidSig = async (
  did: string,
  data: Uint8Array,
  sig: Uint8Array,
): Promise<boolean> => {
  const { jwtAlg, keyBytes } = parseDidKey(did)
  if (jwtAlg !== P256_JWT_ALG) {
    throw new Error(`Not a P-256 did:key: ${did}`)
  }
  return verify(keyBytes, data, sig)
}

export const verify = async (
  publicKey: Uint8Array,
  data: Uint8Array,
  sig: Uint8Array,
): Promise<boolean> => {
  const importedKey = await importEcdsaPublicKey(publicKey)
  return webcrypto.subtle.verify(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    importedKey,
    new Uint8Array(sig),
    new Uint8Array(data),
  )
}

export const importEcdsaPublicKey = async (
  keyBytes: Uint8Array,
): Promise<CryptoKey> => {
  return webcrypto.subtle.importKey(
    'raw',
    new Uint8Array(keyBytes),
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['verify'],
  )
}
