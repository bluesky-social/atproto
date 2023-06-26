import fs from 'node:fs'
import * as uint8arrays from 'uint8arrays'
import EcdsaKeypair from '../src/p256/keypair'
import Secp256k1Keypair from '../src/secp256k1/keypair'
import * as p256 from '../src/p256/operations'
import * as secp from '../src/secp256k1/operations'
import { cborEncode } from '@atproto/common'
import {
  bytesToMultibase,
  multibaseToBytes,
  parseDidKey,
  P256_JWT_ALG,
  SECP256K1_JWT_ALG,
} from '../src'

describe('signatures', () => {
  let vectors: TestVector[]

  beforeAll(() => {
    vectors = JSON.parse(
      fs.readFileSync(`${__dirname}/signature-fixtures.json`).toString(),
    )
  })

  it('verifies secp256k1 and P-256 test vectors', async () => {
    for (const vector of vectors) {
      const messageBytes = uint8arrays.fromString(
        vector.messageBase64,
        'base64',
      )
      const signatureBytes = uint8arrays.fromString(
        vector.signatureBase64,
        'base64',
      )
      const keyBytes = multibaseToBytes(vector.publicKeyMultibase)
      const didKey = parseDidKey(vector.publicKeyDid)
      expect(uint8arrays.equals(keyBytes, didKey.keyBytes))
      if (vector.algorithm === P256_JWT_ALG) {
        const verified = await p256.verify(
          keyBytes,
          messageBytes,
          signatureBytes,
        )
        expect(verified).toEqual(true)
      } else if (vector.algorithm === SECP256K1_JWT_ALG) {
        const verified = await secp.verify(
          keyBytes,
          messageBytes,
          signatureBytes,
        )
        expect(verified).toEqual(true)
      } else {
        throw new Error('Unsupported test vector')
      }
    }
  })
})

async function generateTestVectors(): Promise<TestVector[]> {
  const p256Key = await EcdsaKeypair.create()
  const secpKey = await Secp256k1Keypair.create()
  const messageBytes = cborEncode({ hello: 'world' })
  const messageBase64 = uint8arrays.toString(messageBytes, 'base64')
  return [
    {
      messageBase64,
      algorithm: P256_JWT_ALG, // "ES256" / ecdsa p-256
      publicKeyDid: p256Key.did(),
      publicKeyMultibase: bytesToMultibase(
        p256Key.publicKeyBytes(),
        'base58btc',
      ),
      signatureBase64: uint8arrays.toString(
        await p256Key.sign(messageBytes),
        'base64',
      ),
    },
    {
      messageBase64,
      algorithm: SECP256K1_JWT_ALG, // "ES256K" / secp256k
      publicKeyDid: secpKey.did(),
      publicKeyMultibase: bytesToMultibase(
        secpKey.publicKeyBytes(),
        'base58btc',
      ),
      signatureBase64: uint8arrays.toString(
        await secpKey.sign(messageBytes),
        'base64',
      ),
    },
  ]
}

type TestVector = {
  algorithm: string
  publicKeyDid: string
  publicKeyMultibase: string
  messageBase64: string
  signatureBase64: string
}
