import { ed25519 } from '@noble/curves/ed25519'
import { sha256 } from '@noble/hashes/sha256'
import {
  fromString as ui8FromString,
  toString as ui8ToString,
} from 'uint8arrays'
import { SupportedEncodings } from 'uint8arrays/to-string'
import { ED25519_JWT_ALG } from '../const'
import * as did from '../did'
import { Keypair } from '../types'

export type Ed25519KeypairOptions = {
  exportable: boolean
}

export class Ed25519Keypair implements Keypair {
  jwtAlg = ED25519_JWT_ALG
  private publicKey: Uint8Array

  constructor(
    private privateKey: Uint8Array,
    private exportable: boolean,
  ) {
    this.publicKey = ed25519.getPublicKey(privateKey)
  }

  static async create(
    opts?: Partial<Ed25519KeypairOptions>,
  ): Promise<Ed25519Keypair> {
    const { exportable = false } = opts || {}
    const privKey = ed25519.utils.randomPrivateKey()
    return new Ed25519Keypair(privKey, exportable)
  }

  static async import(
    privKey: Uint8Array | string,
    opts?: Partial<Ed25519KeypairOptions>,
  ): Promise<Ed25519Keypair> {
    const { exportable = false } = opts || {}
    const privKeyBytes =
      typeof privKey === 'string' ? ui8FromString(privKey, 'hex') : privKey
    return new Ed25519Keypair(privKeyBytes, exportable)
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
    const sig = await ed25519.sign(msgHash, this.privateKey)
    return sig.toCompactRawBytes()
  }

  async export(): Promise<Uint8Array> {
    if (!this.exportable) {
      throw new Error('Private key is not exportable')
    }
    return this.privateKey
  }
}
