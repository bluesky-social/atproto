import { webcrypto } from 'one-webcrypto'
import * as encoding from './encoding'

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
  const keyBytes = encoding.pubkeyBytesFromDid(did)
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
    sig,
    data,
  )
}

export const importEcdsaPublicKey = async (
  keyBytes: Uint8Array,
): Promise<CryptoKey> => {
  return webcrypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['verify'],
  )
}

export const importEcdhPublicKey = async (
  keyBytes: Uint8Array,
): Promise<CryptoKey> => {
  return webcrypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    [],
  )
}
