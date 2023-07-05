import P256Keypair from '../src/p256/keypair'
import Secp256k1Keypair from '../src/secp256k1/keypair'
import * as secpEncoding from '../src/secp256k1/encoding'
import * as p256Encoding from '../src/p256/encoding'
import * as did from '../src/did'

describe('public key compression', () => {
  describe('secp256k1', () => {
    let keyBytes: Uint8Array
    let compressed: Uint8Array

    it('compresses a key to the correct length', async () => {
      const keypair = await Secp256k1Keypair.create()
      const parsed = did.parseDidKey(keypair.did())
      keyBytes = parsed.keyBytes
      compressed = secpEncoding.compressPubkey(keyBytes)
      expect(compressed.length).toBe(33)
    })

    it('decompresses a key to the original', async () => {
      const decompressed = secpEncoding.decompressPubkey(compressed)
      expect(decompressed.length).toBe(65)
      expect(decompressed).toEqual(keyBytes)
    })

    it('works consistently', async () => {
      const pubkeys: Uint8Array[] = []
      for (let i = 0; i < 100; i++) {
        const key = await Secp256k1Keypair.create()
        const parsed = did.parseDidKey(key.did())
        pubkeys.push(parsed.keyBytes)
      }
      const compressed = pubkeys.map(secpEncoding.compressPubkey)
      const decompressed = compressed.map(secpEncoding.decompressPubkey)
      expect(pubkeys).toEqual(decompressed)
    })
  })

  describe('P-256', () => {
    let keyBytes: Uint8Array
    let compressed: Uint8Array

    it('compresses a key to the correct length', async () => {
      const keypair = await P256Keypair.create()
      const parsed = did.parseDidKey(keypair.did())
      keyBytes = parsed.keyBytes
      compressed = p256Encoding.compressPubkey(keyBytes)
      expect(compressed.length).toBe(33)
    })

    it('decompresses a key to the original', async () => {
      const decompressed = p256Encoding.decompressPubkey(compressed)
      expect(decompressed.length).toBe(65)
      expect(decompressed).toEqual(keyBytes)
    })

    it('works consistently', async () => {
      const pubkeys: Uint8Array[] = []
      for (let i = 0; i < 100; i++) {
        const key = await P256Keypair.create()
        const parsed = did.parseDidKey(key.did())
        pubkeys.push(parsed.keyBytes)
      }
      const compressed = pubkeys.map(p256Encoding.compressPubkey)
      const decompressed = compressed.map(p256Encoding.decompressPubkey)
      expect(pubkeys).toEqual(decompressed)
    })
  })
})
