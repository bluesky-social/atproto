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

export async function makeAESKey(): Promise<CryptoKey> {
  return webcrypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt'],
  )
}

const randomIV = (): Uint8Array => {
  return webcrypto.getRandomValues(new Uint8Array(12))
}

// utf8 data -> base64pad cipher
export async function encrypt(data: string, key: CryptoKey): Promise<string> {
  const iv = randomIV()
  const dataBytes = uint8arrays.fromString(data, 'utf8')
  const buf = await webcrypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    dataBytes,
  )
  const encryptedBytes = new Uint8Array(buf)
  const encrypted = uint8arrays.toString(
    uint8arrays.concat([iv, encryptedBytes]),
    'base64pad',
  )
  return encrypted
}

// base64pad cipher -> utf8 data
export async function decrypt(data: string, key: CryptoKey): Promise<string> {
  const dataBytes = uint8arrays.fromString(data, 'base64pad')
  const iv = dataBytes.slice(0, 12)
  const encrypted = dataBytes.slice(12)
  const buf = await webcrypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    encrypted,
  )
  const decryptedBytes = new Uint8Array(buf)
  return uint8arrays.toString(decryptedBytes, 'utf8')
}
