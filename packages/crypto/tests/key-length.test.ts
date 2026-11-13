import * as uint8arrays from 'uint8arrays'
import {
  P256Keypair,
  Secp256k1Keypair,
  bytesToMultibase,
  multibaseToBytes,
  parseDidKey,
  parseMultikey,
  verifySignature,
} from '../src/index.js'
import { decompressPubkey as p256Decompress } from '../src/p256/encoding.js'
import { decompressPubkey as secp256k1Decompress } from '../src/secp256k1/encoding.js'

// base58btc decoding is quadratic in the input length, so each of these would
// take seconds to decode if the length were not checked first.
const oversized = 'z' + 'a'.repeat(200_000)

describe('base58btc key length limit', () => {
  it('still decodes the largest supported keys', async () => {
    const k256 = await Secp256k1Keypair.create()
    const p256 = await P256Keypair.create()

    expect(parseDidKey(k256.did()).jwtAlg).toBe('ES256K')
    expect(parseDidKey(p256.did()).jwtAlg).toBe('ES256')

    // Legacy DID document key types carry uncompressed 65-byte keys.
    for (const uncompressed of [
      secp256k1Decompress(k256.publicKeyBytes()),
      p256Decompress(p256.publicKeyBytes()),
    ]) {
      expect(uncompressed.length).toBe(65)
      const mb = bytesToMultibase(uncompressed, 'base58btc')
      expect(uint8arrays.equals(multibaseToBytes(mb), uncompressed)).toBe(true)
    }
  })

  it('rejects oversized keys without decoding them', async () => {
    const start = performance.now()
    expect(() => parseMultikey(oversized)).toThrow('base58btc key too long')
    expect(() => parseDidKey(`did:key:${oversized}`)).toThrow(
      'base58btc key too long',
    )
    expect(() => multibaseToBytes(oversized)).toThrow('base58btc key too long')
    await expect(
      (async () =>
        verifySignature(
          `did:key:${oversized}`,
          new Uint8Array(32),
          new Uint8Array(64),
        ))(),
    ).rejects.toThrow('base58btc key too long')
    expect(performance.now() - start).toBeLessThan(100)
  })
})
