import { webcrypto } from 'one-webcrypto'
import * as aes from './aes.js'
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

  async deriveSharedKey(otherDid: string): Promise<CryptoKey> {
    const publicKey = await util.pubkeyFromDid(otherDid)
    return webcrypto.subtle.deriveKey(
      { name: 'ECDH', public: publicKey },
      this.keypair.privateKey,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false,
      ['encrypt', 'decrypt'],
    )
  }

  // returns base64 encrypted data with iv prepended
  async encryptForDid(data: string, otherDid: string): Promise<string> {
    const sharedKey = await this.deriveSharedKey(otherDid)
    return aes.encrypt(data, sharedKey)
  }

  // expects base64 encrypted data with iv prepended
  async decryptFromDid(data: string, otherDid: string): Promise<string> {
    const sharedKey = await this.deriveSharedKey(otherDid)
    return aes.decrypt(data, sharedKey)
  }
}

export default EcdhKeypair
