import * as aws from '@aws-sdk/client-kms'
import { secp256k1 as noble } from '@noble/curves/secp256k1'
import KeyEncoder from 'key-encoder'
import * as ui8 from 'uint8arrays'
import * as crypto from '@atproto/crypto'

const keyEncoder = new KeyEncoder('secp256k1')

export type KmsConfig = { keyId: string } & Omit<
  aws.KMSClientConfig,
  'apiVersion'
>

export class KmsKeypair implements crypto.Keypair {
  jwtAlg = crypto.SECP256K1_JWT_ALG

  constructor(
    private client: aws.KMS,
    private keyId: string,
    private publicKey: Uint8Array,
  ) {}

  static async load(cfg: KmsConfig) {
    const { keyId, ...rest } = cfg
    const client = new aws.KMS({
      ...rest,
      apiVersion: '2014-11-01',
    })
    const res = await client.getPublicKey({ KeyId: keyId })
    if (!res.PublicKey) {
      throw new Error('Could not find public key')
    }
    // public key comes back DER-encoded, so we translate it to raw 65 byte encoding
    const rawPublicKeyHex = keyEncoder.encodePublic(
      Buffer.from(res.PublicKey),
      'der',
      'raw',
    )
    const publicKey = ui8.fromString(rawPublicKeyHex, 'hex')
    return new KmsKeypair(client, keyId, publicKey)
  }

  did(): string {
    return crypto.formatDidKey(this.jwtAlg, this.publicKey)
  }

  async sign(msg: Uint8Array): Promise<Uint8Array> {
    const res = await this.client.sign({
      KeyId: this.keyId,
      Message: msg,
      SigningAlgorithm: 'ECDSA_SHA_256',
    })
    if (!res.Signature) {
      throw new Error('Could not get signature')
    }
    // signature comes back DER encoded & not-normalized
    // we translate to raw 64 byte encoding
    // we also normalize s as no more than 1/2 prime order to pass strict verification
    // (prevents duplicating a signature)
    // more: https://github.com/bitcoin-core/secp256k1/blob/a1102b12196ea27f44d6201de4d25926a2ae9640/include/secp256k1.h#L530-L534
    const sig = noble.Signature.fromDER(res.Signature)
    const normalized = sig.normalizeS()
    return normalized.toCompactRawBytes()
  }
}

export default KmsKeypair
