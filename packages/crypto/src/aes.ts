import { webcrypto } from 'one-webcrypto'
import * as uint8arrays from 'uint8arrays'

import * as random from './random'

export class AesKey {
  private key: CryptoKey
  constructor(key: CryptoKey) {
    this.key = key
  }

  static async create(): Promise<AesKey> {
    const key = await webcrypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt'],
    )
    return new AesKey(key)
  }

  // utf8 data -> base64pad cipher
  // returns base64 encrypted data with iv prepended
  async encrypt(data: string): Promise<string> {
    const iv = random.randomIV()
    const dataBytes = uint8arrays.fromString(data, 'utf8')
    const buf = await webcrypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      this.key,
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
  async decrypt(data: string): Promise<string> {
    const dataBytes = uint8arrays.fromString(data, 'base64pad')
    const iv = dataBytes.slice(0, 12)
    const encrypted = dataBytes.slice(12)
    const buf = await webcrypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      this.key,
      encrypted,
    )
    const decryptedBytes = new Uint8Array(buf)
    return uint8arrays.toString(decryptedBytes, 'utf8')
  }
}

export default AesKey
