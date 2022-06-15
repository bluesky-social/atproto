import { webcrypto } from 'one-webcrypto'
import * as uint8arrays from 'uint8arrays'
import * as ucan from 'ucans'
import * as util from './util.js'

export class EcdsaKeypair implements ucan.Keypair, ucan.Didable {
  keyType: ucan.KeyType
  publicKey: Uint8Array
  private keypair: CryptoKeyPair

  constructor(keypair: CryptoKeyPair, publicKey: Uint8Array) {
    this.keypair = keypair
    this.publicKey = publicKey
    this.keyType = 'p256'
  }

  static async create(): Promise<EcdsaKeypair> {
    const keypair = await webcrypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign', 'verify'],
    )
    const pubkeyBuf = await webcrypto.subtle.exportKey('raw', keypair.publicKey)
    const pubkeyBytes = new Uint8Array(pubkeyBuf)
    return new EcdsaKeypair(keypair, pubkeyBytes)
  }

  publicKeyStr(encoding: ucan.Encodings = 'base64pad'): string {
    return uint8arrays.toString(this.publicKey, encoding)
  }

  did(): string {
    return util.didForPubkeyBytes(this.publicKey)
  }

  async sign(msg: Uint8Array): Promise<Uint8Array> {
    const buf = await webcrypto.subtle.sign(
      { name: 'ECDSA', hash: { name: 'SHA-256' } },
      this.keypair.privateKey,
      msg.buffer,
    )
    return new Uint8Array(buf)
  }
}

export default EcdsaKeypair
