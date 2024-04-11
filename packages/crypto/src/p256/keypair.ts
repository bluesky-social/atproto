import { p256 } from '@noble/curves/p256'
import { sha256 } from '@noble/hashes/sha256'
import { SupportedEncodings } from 'uint8arrays/to-string'
import {
  fromString as ui8FromString,
  toString as ui8ToString,
} from 'uint8arrays'

import * as did from '../did'
import { P256_JWT_ALG } from '../const'
import { Keypair } from '../types'

export type P256KeypairOptions = {
  exportable: boolean
}

export class P256Keypair implements Keypair {
  jwtAlg = P256_JWT_ALG
  private publicKey: Uint8Array

  constructor(
    private privateKey: Uint8Array,
    private exportable: boolean,
  ) {
    this.publicKey = p256.getPublicKey(privateKey)
  }

  static async create(
    opts?: Partial<P256KeypairOptions>,
  ): Promise<P256Keypair> {
    const { exportable = false } = opts || {}
    const privKey = p256.utils.randomPrivateKey()
    return new P256Keypair(privKey, exportable)
  }

  static async import(
    privKey: Uint8Array | string,
    opts?: Partial<P256KeypairOptions>,
  ): Promise<P256Keypair> {
    const { exportable = false } = opts || {}
    const privKeyBytes =
      typeof privKey === 'string' ? ui8FromString(privKey, 'hex') : privKey
    return new P256Keypair(privKeyBytes, exportable)
  }

  publicKeyBytes(): Uint8Array {
    return this.publicKey
  }

  publicKeyStr(encoding: SupportedEncodings = 'base64pad'): string {
    return ui8ToString(this.publicKey, encoding)
  }

  did(): string {
    return did.formatDidKey(this.jwtAlg, this.publicKey)
  }

  async sign(msg: Uint8Array): Promise<Uint8Array> {
    const msgHash = await sha256(msg)
    // return raw 64 byte sig not DER-encoded
    const sig = await p256.sign(msgHash, this.privateKey, { lowS: true })
    return sig.toCompactRawBytes()
  }

  async export(): Promise<Uint8Array> {
    if (!this.exportable) {
      throw new Error('Private key is not exportable')
    }
    return this.privateKey
  }
}

export default P256Keypair
