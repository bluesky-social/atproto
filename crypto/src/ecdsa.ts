import { webcrypto } from 'one-webcrypto'
import * as uint8arrays from 'uint8arrays'
import * as ucan from 'ucans'
import * as util from './util.js'

export type EcdsaKeypairOptions = {
  exportable: boolean
  encoding: ucan.Encodings
}

export type KeyExport = {
  publicKey: string
  privateKey: string
}

export class EcdsaKeypair implements ucan.Keypair, ucan.Didable {
  keyType: ucan.KeyType
  publicKey: Uint8Array
  private keypair: CryptoKeyPair
  private exportable: boolean

  constructor(
    keypair: CryptoKeyPair,
    publicKey: Uint8Array,
    exportable: boolean,
  ) {
    this.keypair = keypair
    this.publicKey = publicKey
    this.keyType = 'p256'
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
    keyExport: KeyExport,
    opts?: Partial<EcdsaKeypairOptions>,
  ): Promise<EcdsaKeypair> {
    const { exportable = false, encoding = 'base64pad' } = opts || {}
    const pubBytes = uint8arrays.fromString(keyExport.publicKey, encoding)
    const privBytes = uint8arrays.fromString(keyExport.privateKey, encoding)

    const privateKey = await webcrypto.subtle.importKey(
      'pkcs8',
      privBytes.buffer,
      { name: 'ECDSA', namedCurve: 'P-256' },
      exportable,
      ['sign'],
    )
    const publicKey = await webcrypto.subtle.importKey(
      'raw',
      pubBytes,
      { name: 'ECDSA', namedCurve: 'P-256' },
      exportable,
      ['verify'],
    )
    const keypair = { privateKey, publicKey }
    return new EcdsaKeypair(keypair, pubBytes, exportable)
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

  async export(encoding: ucan.Encodings = 'base64pad'): Promise<KeyExport> {
    if (!this.exportable) {
      throw new Error('Private key is not exportable')
    }
    const privBuf = await webcrypto.subtle.exportKey(
      'pkcs8',
      this.keypair.privateKey,
    )
    const pubBuf = await webcrypto.subtle.exportKey(
      'raw',
      this.keypair.publicKey,
    )
    return {
      publicKey: uint8arrays.toString(new Uint8Array(pubBuf), encoding),
      privateKey: uint8arrays.toString(new Uint8Array(privBuf), encoding),
    }
  }
}

export default EcdsaKeypair
