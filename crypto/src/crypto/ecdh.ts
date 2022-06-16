import { webcrypto } from 'one-webcrypto'
import AesKey from './aes.js'
import * as util from './util.js'

export class EcdhKeypair {
  private keypair: CryptoKeyPair
  constructor(keypair: CryptoKeyPair) {
    this.keypair = keypair
  }

  static async create(): Promise<EcdhKeypair> {
    const keypair = await webcrypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveKey', 'deriveBits'],
    )
    return new EcdhKeypair(keypair)
  }

  async did(): Promise<string> {
    return util.didForPubkey(this.keypair.publicKey)
  }

  async deriveSharedKey(otherDid: string): Promise<AesKey> {
    const publicKey = await util.pubkeyFromDid(otherDid)
    const key = await webcrypto.subtle.deriveKey(
      { name: 'ECDH', public: publicKey },
      this.keypair.privateKey,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false,
      ['encrypt', 'decrypt'],
    )
    return new AesKey(key)
  }

  // returns base64 encrypted data with iv prepended
  async encryptForDid(data: string, otherDid: string): Promise<string> {
    const sharedKey = await this.deriveSharedKey(otherDid)
    return sharedKey.encrypt(data)
  }

  // expects base64 encrypted data with iv prepended
  async decryptFromDid(data: string, otherDid: string): Promise<string> {
    const sharedKey = await this.deriveSharedKey(otherDid)
    return sharedKey.decrypt(data)
  }
}

export default EcdhKeypair
