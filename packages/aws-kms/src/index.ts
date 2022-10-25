import * as aws from '@aws-sdk/client-kms'
import * as secp from '@noble/secp256k1'
import * as crypto from '@atproto/crypto'
import KeyEncoder from 'key-encoder'

const keyEncoder = new KeyEncoder('secp256k1')

export type KmsConfig = {
  accessKey: string
  secretKey: string
  keyId: string
  region: string
}

export class KmsKeypair {
  jwtAlg = crypto.SECP256K1_JWT_ALG

  constructor(
    private client: aws.KMS,
    private keyId: string,
    private publicKey: Uint8Array,
  ) {}

  static async load(cfg: KmsConfig) {
    const client = new aws.KMS({
      region: cfg.region,
      credentials: {
        accessKeyId: cfg.accessKey,
        secretAccessKey: cfg.secretKey,
      },
    })
    const res = await client.getPublicKey({ KeyId: cfg.keyId })
    if (!res.PublicKey) {
      throw new Error('Could not find public key')
    }
    const rawPublicKeyHex = keyEncoder.encodePublic(
      Buffer.from(res.PublicKey),
      'der',
      'raw',
    )
    const publicKey = secp.utils.hexToBytes(rawPublicKeyHex)

    return new KmsKeypair(client, cfg.keyId, publicKey)
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
    return res.Signature
  }
}

export default KmsKeypair
