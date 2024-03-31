import { secp256k1 as k256 } from '@noble/curves/secp256k1'
import { sha256 } from '@noble/hashes/sha256'
import {
  fromString as ui8FromString,
  toString as ui8ToString,
} from 'uint8arrays'
import { SupportedEncodings } from 'uint8arrays/to-string'

import { SECP256K1_JWT_ALG } from '../const'
import * as did from '../did'
import { Keypair } from '../types'

export type Secp256k1KeypairOptions = {
  exportable: boolean
}

export class Secp256k1Keypair implements Keypair {
  jwtAlg = SECP256K1_JWT_ALG
  private publicKey: Uint8Array

  constructor(
    private privateKey: Uint8Array,
    private exportable: boolean,
  ) {
    this.publicKey = k256.getPublicKey(privateKey)
  }

  static async create(
    opts?: Partial<Secp256k1KeypairOptions>,
  ): Promise<Secp256k1Keypair> {
    const { exportable = false } = opts || {}
    const privKey = k256.utils.randomPrivateKey()
    return new Secp256k1Keypair(privKey, exportable)
  }

  static async import(
    privKey: Uint8Array | string,
    opts?: Partial<Secp256k1KeypairOptions>,
  ): Promise<Secp256k1Keypair> {
    const { exportable = false } = opts || {}
    const privKeyBytes =
      typeof privKey === 'string' ? ui8FromString(privKey, 'hex') : privKey
    return new Secp256k1Keypair(privKeyBytes, exportable)
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
    const sig = await k256.sign(msgHash, this.privateKey, { lowS: true })
    return sig.toCompactRawBytes()
  }

  async export(): Promise<Uint8Array> {
    if (!this.exportable) {
      throw new Error('Private key is not exportable')
    }
    return this.privateKey
  }
}

export default Secp256k1Keypair
