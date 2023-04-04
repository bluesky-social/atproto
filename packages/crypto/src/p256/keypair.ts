import { webcrypto } from 'one-webcrypto'
import * as uint8arrays from 'uint8arrays'
import { SupportedEncodings } from 'uint8arrays/util/bases'
import * as did from '../did'
import * as operations from './operations'
import { P256_JWT_ALG } from '../const'
import { Keypair } from '../types'

export type EcdsaKeypairOptions = {
  exportable: boolean
}

export class EcdsaKeypair implements Keypair {
  jwtAlg = P256_JWT_ALG
  private publicKey: Uint8Array
  private keypair: CryptoKeyPair
  private exportable: boolean

  constructor(
    keypair: CryptoKeyPair,
    publicKey: Uint8Array,
    exportable: boolean,
  ) {
    this.keypair = keypair
    this.publicKey = publicKey
    this.exportable = exportable
  }

  static async create(
    opts?: Partial<EcdsaKeypairOptions>,
  ): Promise<EcdsaKeypair> {
    const { exportable = false } = opts || {}
    const keypair = await webcrypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      exportable,
      ['sign', 'verify'],
    )
    const pubkeyBuf = await webcrypto.subtle.exportKey('raw', keypair.publicKey)
    const pubkeyBytes = new Uint8Array(pubkeyBuf)
    return new EcdsaKeypair(keypair, pubkeyBytes, exportable)
  }

  static async import(
    jwk: JsonWebKey,
    opts?: Partial<EcdsaKeypairOptions>,
  ): Promise<EcdsaKeypair> {
    const { exportable = false } = opts || {}
    const keypair = await operations.importKeypairJwk(jwk, exportable)
    const pubkeyBuf = await webcrypto.subtle.exportKey('raw', keypair.publicKey)
    const pubkeyBytes = new Uint8Array(pubkeyBuf)
    return new EcdsaKeypair(keypair, pubkeyBytes, exportable)
  }

  publicKeyBytes(): Uint8Array {
    return this.publicKey
  }

  publicKeyStr(encoding: SupportedEncodings = 'base64pad'): string {
    return uint8arrays.toString(this.publicKey, encoding)
  }

  did(): string {
    return did.formatDidKey(this.jwtAlg, this.publicKey)
  }

  async sign(msg: Uint8Array): Promise<Uint8Array> {
    const buf = await webcrypto.subtle.sign(
      { name: 'ECDSA', hash: { name: 'SHA-256' } },
      this.keypair.privateKey,
      new Uint8Array(msg),
    )
    return new Uint8Array(buf)
  }

  async export(): Promise<JsonWebKey> {
    if (!this.exportable) {
      throw new Error('Private key is not exportable')
    }
    const jwk = await webcrypto.subtle.exportKey('jwk', this.keypair.privateKey)
    return jwk
  }
}

export default EcdsaKeypair
