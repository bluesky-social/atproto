import { webcrypto } from 'one-webcrypto'

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
