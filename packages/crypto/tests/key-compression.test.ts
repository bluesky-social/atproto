import EcdsaKeypair from '../src/p256/ecdsa'
import * as encoding from '../src/p256/encoding'

describe('public key compression', () => {
  let keyBytes: Uint8Array
  let compressed: Uint8Array

  it('compresses a key to the correct length', async () => {
    const keypair = await EcdsaKeypair.create()
    keyBytes = encoding.pubkeyBytesFromDid(keypair.did())
    compressed = encoding.compressPubkey(keyBytes)
    expect(compressed.length).toBe(33)
  })

  it('decompresses a key to the original', async () => {
    const decompressed = encoding.decompressPubkey(compressed)
    expect(decompressed.length).toBe(65)
    expect(decompressed).toEqual(keyBytes)
  })

  it('works consistently', async () => {
    const pubkeys: Uint8Array[] = []
    for (let i = 0; i < 1000; i++) {
      const key = await EcdsaKeypair.create()
      const keyBytes = encoding.pubkeyBytesFromDid(key.did())
      pubkeys.push(keyBytes)
    }
    const compressed = pubkeys.map(encoding.compressPubkey)
    const decompressed = compressed.map(encoding.decompressPubkey)
    expect(pubkeys).toEqual(decompressed)
  })
})
