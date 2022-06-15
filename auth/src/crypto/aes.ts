import { webcrypto } from 'one-webcrypto'
import * as uint8arrays from 'uint8arrays'

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
// returns base64 encrypted data with iv prepended
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
// expects base64 encrypted data with iv prepended
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
