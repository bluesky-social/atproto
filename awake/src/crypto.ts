import { webcrypto } from 'one-webcrypto'
import * as uint8arrays from 'uint8arrays'

export const P256_DID_PREFIX = new Uint8Array([0x80, 0x24])
export const BASE58_DID_PREFIX = 'did:key:z' // z is the multibase prefix for base58btc byte encoding

// ASYMMETRIC KEYS WITH NIST-P256
// ----------------

export const makeEcdhKeypair = (): Promise<CryptoKeyPair> => {
  return webcrypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveKey', 'deriveBits'],
  )
}

export const didForKeypair = async (
  keypair: CryptoKeyPair,
): Promise<string> => {
  const buf = await webcrypto.subtle.exportKey('raw', keypair.publicKey)
  const bytes = new Uint8Array(buf)
  const prefixedBytes = uint8arrays.concat([P256_DID_PREFIX, bytes])
  return BASE58_DID_PREFIX + uint8arrays.toString(prefixedBytes, 'base58btc')
}

export const pubkeyFromDid = async (did: string): Promise<CryptoKey> => {
  if (!did.startsWith(BASE58_DID_PREFIX)) {
    throw new Error('Please use a base58-encoded DID formatted `did:key:z...`')
  }
  const didWithoutPrefix = did.slice(BASE58_DID_PREFIX.length)
  const didBytes = uint8arrays.fromString(didWithoutPrefix, 'base58btc')
  if (!uint8arrays.equals(P256_DID_PREFIX, didBytes.slice(0, 2))) {
    throw new Error('Unsupported key method')
  }
  const keyBytes = didBytes.slice(2)
  return webcrypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    [],
  )
}

export async function deriveSharedKey(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
): Promise<CryptoKey> {
  return webcrypto.subtle.deriveKey(
    { name: 'ECDH', public: publicKey },
    privateKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt'],
  )
}

// SYMMETRIC KEYS WITH 256 BIT AES-GCM
// ----------------
